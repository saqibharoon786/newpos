const mongoose = require("mongoose");
const { ProcessingMaterial, ProductionData } = require("../models/process.model.js");
const Purchase = require("../models/pop.model.js");
const Employee = require("../models/employee.model.js");
const { computeProductionCosts } = require("../utils/productionCost");
const {
  deductPopWeight,
  restorePopWeight,
  getPopLinePricing,
  buildProcessingQueueItems,
} = require("../utils/popMaterialConsumption");

function parsePurchaseDate(purchase) {
  const d = purchase.purchaseDate;
  if (!d) return purchase.createdAt || new Date();
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [y, m, day] = d.split(/[-T]/).map(Number);
    return new Date(y, m - 1, day);
  }
  if (typeof d === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(d)) {
    const [dd, mm, yyyy] = d.split("/").map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? purchase.createdAt || new Date() : parsed;
}

function normCodeForFilter(c) {
  return String(c || "").trim();
}

function formatProcessError(error) {
  if (error.name === "ValidationError") {
    return Object.values(error.errors)
      .map((e) => e.message)
      .join("; ");
  }
  if (error.name === "CastError") {
    return `Invalid ${error.path}: ${error.value}`;
  }
  return error.message || "Failed to process";
}

/** Processing queue — server calculates per-code weight (100/105/110 alag) */
const getProcessingQueue = async (req, res) => {
  try {
    const purchases = await Purchase.find().sort({ createdAt: -1 }).lean();
    const items = buildProcessingQueueItems(purchases);
    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to load processing queue",
    });
  }
};

// Get all processing materials from purchases
const getProcessingMaterials = async (req, res) => {
  try {
    const purchases = await Purchase.find().sort({ createdAt: -1 });
    const eligiblePurchases = purchases.filter((purchase) => {
      const originalWeight = parseFloat(purchase.weight) || 0;
      const sold = parseFloat(purchase.soldWeight) || 0;
      const consumed = parseFloat(purchase.productionConsumedWeight) || 0;
      return originalWeight - sold - consumed > 0;
    });

    const processingMaterials = await Promise.all(eligiblePurchases.map(async (purchase) => {
      const existingMaterial = await ProcessingMaterial.findOne({ purchaseId: purchase._id });
      
      if (existingMaterial) {
        return existingMaterial;
      }

      const originalWeight = parseFloat(purchase.weight) || 0;
      const sold = parseFloat(purchase.soldWeight) || 0;
      const consumed = parseFloat(purchase.productionConsumedWeight) || 0;
      const availableForProcessing = Math.max(0, originalWeight - sold - consumed);

      // Create new processing material from purchase
      const newMaterial = new ProcessingMaterial({
        purchaseId: purchase._id,
        receiptNo: purchase.receiptNo || "N/A",
        materialName: purchase.materialName || "Unknown",
        quality: purchase.quality || "Unknown",
        color: purchase.materialColor || "#FFFFFF",
        originalWeight,
        availableWeight: availableForProcessing,
        vendor: purchase.vendor || "Unknown",
        purchaseDate: parsePurchaseDate(purchase),
        status: "pending",
      });

      return await newMaterial.save();
    }));

    res.status(200).json({
      success: true,
      count: processingMaterials.length,
      data: processingMaterials
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};

// Update material status
const updateMaterialStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, availableWeight } = req.body;

    // First try by ProcessingMaterial _id
    let material = await ProcessingMaterial.findById(id);

    // If not found, also support legacy calls that send POP purchase _id
    if (!material) {
      material = await ProcessingMaterial.findOne({ purchaseId: id });
    }

    // If still not found, auto-create a ProcessingMaterial from the Purchase
    if (!material) {
      const purchase = await Purchase.findById(id);
      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: "Material not found",
        });
      }

      const originalWeight = parseFloat(purchase.weight) || 0;
      const sold = parseFloat(purchase.soldWeight) || 0;
      const consumed = parseFloat(purchase.productionConsumedWeight) || 0;
      material = await ProcessingMaterial.create({
        purchaseId: purchase._id,
        receiptNo: purchase.receiptNo || "N/A",
        materialName: purchase.materialName || "Unknown",
        quality: purchase.quality || "Unknown",
        color: purchase.materialColor || "#FFFFFF",
        originalWeight,
        availableWeight: Math.max(0, originalWeight - sold - consumed),
        vendor: purchase.vendor || "Unknown",
        purchaseDate: parsePurchaseDate(purchase),
        status: "pending",
      });
    }

    // Update material
    const updates = { status };
    if (availableWeight !== undefined) {
      updates.availableWeight = availableWeight;
    }

    const updatedMaterial = await ProcessingMaterial.findByIdAndUpdate(
      material._id,
      updates,
      {
        new: true,
      }
    );

    // Update purchase remaining weight if status is in_progress
    if (status === "in_progress" && availableWeight !== undefined) {
      await Purchase.findByIdAndUpdate(material.purchaseId, {
        remainingWeight: availableWeight
      });
    }

    res.status(200).json({
      success: true,
      data: updatedMaterial,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};

// Create production record (used by /production)
const createProductionRecord = async (req, res) => {
  try {
    const productionData = { ...req.body };
    const totalWeight = parseFloat(
      productionData.totalWeight ?? productionData.outputWeight ?? productionData.machineOutputWeight
    );
    const totalBags = parseInt(productionData.totalBags, 10);

    if (!productionData.materialName?.trim()) {
      return res.status(400).json({ success: false, message: "Material name is required" });
    }
    if (!productionData.color?.trim()) {
      productionData.color = "#FFFFFF";
    }
    if (!productionData.quality?.trim()) {
      productionData.quality = "Standard";
    }
    if (!productionData.machine || !["machine_1", "machine_2", "machine_3", "machine_4", "machine_5"].includes(productionData.machine)) {
      return res.status(400).json({ success: false, message: "Please select a valid machine" });
    }
    if (!["morning", "evening", "night"].includes(productionData.shift)) {
      return res.status(400).json({ success: false, message: "Please select a valid shift" });
    }
    if (!totalWeight || totalWeight <= 0) {
      return res.status(400).json({ success: false, message: "Machine output weight must be greater than 0" });
    }
    if (!totalBags || totalBags < 1) {
      return res.status(400).json({ success: false, message: "Number of bags must be at least 1" });
    }
    if (!Array.isArray(productionData.employees) || productionData.employees.length === 0) {
      return res.status(400).json({ success: false, message: "Please select at least one employee" });
    }

    productionData.employees = productionData.employees
      .filter((e) => e?.employeeId && mongoose.Types.ObjectId.isValid(e.employeeId))
      .map((e) => ({
        employeeId: e.employeeId,
        name: e.name || "",
        department: e.department || "",
      }));

    if (productionData.employees.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid employee selection — please re-select employees" });
    }
    const purchaseId = productionData.purchaseId;
    const productCode = normCodeForFilter(productionData.productCode);
    const weightUsedFromPOP = productionData.weightUsedFromPOP != null ? parseFloat(productionData.weightUsedFromPOP) : null;

    if (weightUsedFromPOP != null && !isNaN(weightUsedFromPOP) && weightUsedFromPOP > 0) {
      if (!productCode) {
        return res.status(400).json({
          success: false,
          message: "Product code (100/105/110) required — sirf us code ki line se weight cut hoga",
        });
      }
      if (!purchaseId) {
        return res.status(400).json({
          success: false,
          message: "POP purchase required for queue production",
        });
      }
      const result = await deductPopWeight(purchaseId, {
        productCode,
        weight: weightUsedFromPOP,
      });
      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.message });
      }
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    const batchNo = productionData.batchNo || `BATCH-${year}${month}${day}-${randomNum}`;

    // Parse production date as local calendar date so e.g. "2025-02-13" stays Feb 13 (no timezone shift)
    let productionDateValue = productionData.productionDate || new Date();
    if (typeof productionData.productionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(productionData.productionDate)) {
      const [y, m, d] = productionData.productionDate.split("-").map(Number);
      productionDateValue = new Date(y, m - 1, d);
    }

    const wasteWeight = parseFloat(productionData.wasteWeight) || 0;
    const laborCostPerKg = parseFloat(productionData.laborCostPerKg) || 0;
    let purchasePrice = 0;
    let purchaseWeight = 0;
    if (purchaseId) {
      const pop = await Purchase.findById(purchaseId).lean();
      if (pop) {
        const pricing = getPopLinePricing(pop, productCode);
        purchasePrice = pricing.purchasePrice;
        purchaseWeight = pricing.purchaseWeight;
      }
    }
    const costs = computeProductionCosts({
      purchasePrice,
      purchaseWeight,
      weightUsedFromPOP: weightUsedFromPOP || 0,
      outputWeight: totalWeight,
      wasteWeight,
      wasteCost: productionData.wasteCost,
      laborCostPerKg,
      materialCost: productionData.materialCost,
    });
    const { materialCost, wasteCost, totalProductionCost } = costs;

    const record = new ProductionData({
      ...productionData,
      batchNo,
      productionDate: productionDateValue,
      availableWeight: productionData.availableWeight ?? totalWeight,
      weightUsedFromPOP: weightUsedFromPOP || 0,
      purchaseId: purchaseId || undefined,
      wasteWeight,
      wasteCost,
      laborCostPerKg,
      materialCost,
      totalProductionCost,
    });

    await record.save();

    // Populate employee details
    const populatedRecord = await ProductionData.findById(record._id).populate(
      "employees.employeeId",
      "name employeeId department"
    );

    res.status(201).json({
      success: true,
      message:
        weightUsedFromPOP > 0 && productCode
          ? `Code ${productCode}: ${weightUsedFromPOP} kg sirf isi code ki POP line se minus hua`
          : undefined,
      data: populatedRecord,
    });
  } catch (error) {
    console.error("createProductionRecord error:", error);
    res.status(error.name === "ValidationError" || error.name === "CastError" ? 400 : 500).json({
      success: false,
      message: formatProcessError(error),
      error: error.message,
    });
  }
};

// Create production record from old frontend /batches payload
// This keeps your existing process.tsx working without changes.
const createProductionFromBatch = async (req, res) => {
  try {
    const batch = req.body;

    // Generate batch number if frontend didn't send one
    let batchNo = batch.batchNo;
    if (!batchNo) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const randomNum = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      batchNo = `BATCH-${year}${month}${day}-${randomNum}`;
    }

    const employees =
      batch.employees?.map((e) => ({
        employeeId: e.employeeId || e._id,
        name: e.name,
        department: e.department,
      })) || [];

    const totalWeight = batch.inputWeight ?? 0;
    const record = new ProductionData({
      batchNo,
      materialName: batch.materialName,
      quality: batch.quality,
      color: batch.color,
      totalWeight,
      totalBags: batch.totalBags,
      machine: batch.machineId || "machine_1",
      shift: batch.shift,
      productionDate: batch.productionDate
        ? new Date(batch.productionDate)
        : new Date(),
      employees,
      notes: batch.notes || "",
      status: "completed",
      availableWeight: totalWeight,
    });

    await record.save();

    const populatedRecord = await ProductionData.findById(record._id).populate(
      "employees.employeeId",
      "name employeeId department"
    );

    res.status(201).json({
      success: true,
      data: populatedRecord,
    });
  } catch (error) {
    console.error("createProductionFromBatch error:", error);
    res.status(error.name === "ValidationError" || error.name === "CastError" ? 400 : 500).json({
      success: false,
      message: formatProcessError(error),
      error: error.message,
    });
  }
};

// Get production data
const getProductionData = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      machine, 
      shift, 
      status, 
      page = 1, 
      limit = 10 
    } = req.query;
    
    const query = {};
    
    // Date filter
    if (startDate || endDate) {
      query.productionDate = {};
      if (startDate) {
        query.productionDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.productionDate.$lte = new Date(endDate);
      }
    }
    
    if (machine && machine !== "all") {
      query.machine = machine;
    }
    
    if (shift && shift !== "all") {
      query.shift = shift;
    }
    
    if (status && status !== "all") {
      query.status = status;
    }

    const productionDocs = await ProductionData.find(query)
      .populate("employees.employeeId", "name employeeId department")
      .sort({ productionDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const purchaseIds = [
      ...new Set(
        productionDocs.filter((d) => d.purchaseId).map((d) => String(d.purchaseId))
      ),
    ];
    const purchaseDocs = purchaseIds.length
      ? await Purchase.find({ _id: { $in: purchaseIds } }).lean()
      : [];
    const purchaseById = Object.fromEntries(purchaseDocs.map((p) => [String(p._id), p]));

    const total = await ProductionData.countDocuments(query);

    // Calculate summary metrics
    const summary = await ProductionData.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalWeight: { $sum: "$totalWeight" },
          totalBags: { $sum: "$totalBags" },
          count: { $sum: 1 }
        }
      }
    ]);

    // Map to shape expected by frontend ProductionHistory table
    const data = productionDocs.map((doc) => {
      const avail = doc.availableWeight ?? doc.totalWeight ?? 0;
      const pop = doc.purchaseId ? purchaseById[String(doc.purchaseId)] : null;
      let materialCost = doc.materialCost || 0;
      let wasteCost = doc.wasteCost || 0;
      let laborCost = 0;
      let totalProductionCost = doc.totalProductionCost || 0;
      const laborCostPerKg = doc.laborCostPerKg || 0;
      if (pop) {
        const computed = computeProductionCosts({
          purchasePrice: parseFloat(pop.price) || 0,
          purchaseWeight: parseFloat(pop.weight) || 0,
          weightUsedFromPOP: doc.weightUsedFromPOP || 0,
          outputWeight: doc.totalWeight || 0,
          wasteWeight: doc.wasteWeight || 0,
          laborCostPerKg,
        });
        materialCost = computed.materialCost;
        wasteCost = computed.wasteCost;
        laborCost = computed.laborCost;
        totalProductionCost = computed.totalProductionCost;
      } else if (!totalProductionCost) {
        const computed = computeProductionCosts({
          outputWeight: doc.totalWeight || 0,
          weightUsedFromPOP: doc.weightUsedFromPOP || 0,
          wasteWeight: doc.wasteWeight || 0,
          laborCostPerKg,
        });
        materialCost = computed.materialCost;
        wasteCost = computed.wasteCost;
        laborCost = computed.laborCost;
        totalProductionCost = computed.totalProductionCost;
      } else {
        laborCost = laborCostPerKg * (doc.totalWeight || 0);
      }
      return {
        _id: doc._id,
        batchId: doc._id,
        batchNo: doc.batchNo,
        materialName: doc.materialName,
        quality: doc.quality,
        color: doc.color,
        outputWeight: doc.totalWeight,
        availableWeight: avail,
        weightUsedFromPOP: doc.weightUsedFromPOP || 0,
        wasteWeight: doc.wasteWeight || 0,
        wasteCost,
        laborCostPerKg: doc.laborCostPerKg || 0,
        materialCost,
        totalProductionCost,
        laborCost,
        purchasePrice: pop ? parseFloat(pop.price) || 0 : undefined,
        purchaseWeight: pop ? parseFloat(pop.weight) || 0 : undefined,
        vendor: pop?.vendor,
        receiptNo: pop?.receiptNo || pop?.invoiceNo,
        efficiency: doc.totalWeight
          ? Math.round(((doc.totalWeight - (doc.wasteWeight || 0)) / doc.totalWeight) * 100)
          : 0,
        productionDate: doc.productionDate,
        purchaseId: doc.purchaseId || null,
        operator:
          doc.employees?.[0]?.employeeId?.name ||
          doc.employees?.[0]?.name ||
          "",
        shift: doc.shift,
        machineUsed: doc.machine,
        energyConsumed: 0,
        waterUsed: 0,
        status: doc.status || "completed",
        notes: doc.notes || "",
        totalBags: doc.totalBags,
        bagWeight:
          doc.totalBags && doc.totalBags > 0
            ? doc.totalWeight / doc.totalBags
            : 0,
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      total,
      pages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      summary: summary[0] || { totalWeight: 0, totalBags: 0, count: 0 },
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};

// Get processing dashboard data
const getProcessingDashboard = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get pending materials count
    const pendingMaterials = await ProcessingMaterial.countDocuments({
      status: "pending",
      availableWeight: { $gt: 0 }
    });

    // Get materials in progress count
    const inProgressMaterials = await ProcessingMaterial.countDocuments({
      status: "in_progress",
    });

    // Get today's production count
    const todaysProduction = await ProductionData.countDocuments({
      productionDate: { $gte: today, $lt: tomorrow },
    });

    // Get total weight produced today
    const todaysWeight = await ProductionData.aggregate([
      {
        $match: {
          productionDate: { $gte: today, $lt: tomorrow },
        }
      },
      {
        $group: {
          _id: null,
          totalWeight: { $sum: "$totalWeight" },
          totalBags: { $sum: "$totalBags" },
        }
      }
    ]);

    // Get production by machine
    const machineStats = await ProductionData.aggregate([
      {
        $group: {
          _id: "$machine",
          count: { $sum: 1 },
          totalWeight: { $sum: "$totalWeight" },
        },
      }
    ]);

    // Get recent production
    const recentProduction = await ProductionData.find()
      .populate("employees.employeeId", "name")
      .sort({ productionDate: -1 })
      .limit(5)
      .select("batchNo materialName totalWeight totalBags machine shift productionDate");

    res.status(200).json({
      success: true,
      data: {
        pendingMaterials,
        inProgressMaterials,
        todaysProduction,
        todaysWeight: todaysWeight[0]?.totalWeight || 0,
        todaysBags: todaysWeight[0]?.totalBags || 0,
        machineStats,
        recentProduction
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};

// Get production by ID
const getProductionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const production = await ProductionData.findById(id).populate(
      "employees.employeeId",
      "name employeeId department phone email"
    );
    
    if (!production) {
      return res.status(404).json({
        success: false,
        message: "Production record not found",
      });
    }

    res.status(200).json({
      success: true,
      data: production,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Update production record
const updateProduction = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // If weightUsed is provided, calculate availableWeight
    const currentProduction = await ProductionData.findById(id);
    if (!currentProduction) {
      return res.status(404).json({
        success: false,
        message: "Production record not found",
      });
    }

    // If weightUsed is provided, calculate availableWeight (this is SOLD weight/deduction from stock)
    if (updateData.weightUsed !== undefined) {
      const totalWeight = updateData.totalWeight !== undefined ? updateData.totalWeight : currentProduction.totalWeight;
      const weightUsed = parseFloat(updateData.weightUsed) || 0;
      updateData.availableWeight = Math.max(0, totalWeight - weightUsed);
      delete updateData.weightUsed; 
    }

    // If weightUsedFromPOP is updated, adjust the Purchase record
    if (updateData.weightUsedFromPOP !== undefined) {
      const newUsedFromPOP = parseFloat(updateData.weightUsedFromPOP) || 0;
      const oldUsedFromPOP = currentProduction.weightUsedFromPOP || 0;
      const purchaseId = updateData.purchaseId || currentProduction.purchaseId;

      if (purchaseId && newUsedFromPOP !== oldUsedFromPOP) {
        const code = normCodeForFilter(
          updateData.productCode || currentProduction.productCode
        );
        const diff = newUsedFromPOP - oldUsedFromPOP;
        if (code) {
          if (diff > 0) {
            const result = await deductPopWeight(purchaseId, { productCode: code, weight: diff });
            if (!result.ok) {
              return res.status(400).json({ success: false, message: result.message });
            }
          } else if (diff < 0) {
            await restorePopWeight(purchaseId, { productCode: code, weight: -diff });
          }
        }
      }
    }

    const production = await ProductionData.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("employees.employeeId", "name employeeId department");

    if (!production) {
      return res.status(404).json({
        success: false,
        message: "Production record not found",
      });
    }

    res.status(200).json({
      success: true,
      data: production,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Delete production record
const deleteProduction = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the record first to get the weightUsedFromPOP and purchaseId
    const production = await ProductionData.findById(id);

    if (!production) {
      return res.status(404).json({
        success: false,
        message: "Production record not found",
      });
    }

    // Restore consumed weight to Purchase record if applicable
    if (production.weightUsedFromPOP > 0 && production.purchaseId && production.productCode) {
      await restorePopWeight(production.purchaseId, {
        productCode: production.productCode,
        weight: production.weightUsedFromPOP,
      });
    }

    await ProductionData.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Production record deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get production list for POS – aggregated by material+quality+color so dropdown shows total weight (e.g. PP1000 = 1500 kg) not per batch
const getProductionForPOS = async (req, res) => {
  try {
    const docs = await ProductionData.find({
      $or: [
        { availableWeight: { $gt: 0 } },
        { availableWeight: { $exists: false } },
      ],
    })
      .sort({ productionDate: 1 }) // oldest first for FIFO
      .lean();

    const withAvailable = docs.filter(
      (doc) => (doc.availableWeight ?? doc.totalWeight ?? 0) > 0
    );

    // Group by materialName + quality + color; sum availableWeight; keep productionIds in FIFO order
    const groupKey = (d) =>
      `${d.materialName || ""}|${d.quality || "Standard"}|${(d.color || "#FFFFFF").toString().trim()}`;
    const groups = new Map();
    for (const doc of withAvailable) {
      const key = groupKey(doc);
      const avail = doc.availableWeight ?? doc.totalWeight ?? 0;
      if (!groups.has(key)) {
        groups.set(key, {
          materialName: doc.materialName,
          quality: doc.quality || "Standard",
          color: doc.color || "#FFFFFF",
          totalAvailableWeight: 0,
          productionIds: [],
        });
      }
      const g = groups.get(key);
      g.totalAvailableWeight += avail;
      g.productionIds.push(doc._id);
    }

    const data = Array.from(groups.values()).map((g) => ({
      materialName: g.materialName,
      quality: g.quality,
      color: g.color,
      totalAvailableWeight: g.totalAvailableWeight,
      productionIds: g.productionIds,
    }));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Export production data
const exportProductionData = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate || endDate) {
      query.productionDate = {};
      if (startDate) {
        query.productionDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.productionDate.$lte = new Date(endDate);
      }
    }

    const productionData = await ProductionData.find(query)
      .populate("employees.employeeId", "name employeeId department")
      .sort({ productionDate: -1 });

    // Format data for CSV/Excel
    const formattedData = productionData.map(record => ({
      "Batch No": record.batchNo,
      Material: record.materialName,
      Quality: record.quality,
      Color: record.color,
      "Total Weight (kg)": record.totalWeight,
      "Total Bags": record.totalBags,
      Machine: record.machine,
      Shift: record.shift,
      "Production Date": record.productionDate.toLocaleDateString(),
      Employees: record.employees.map((e) => e.name).join(", "),
      Status: record.status,
      Notes: record.notes || "",
    }));

    res.status(200).json({
      success: true,
      data: formattedData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

module.exports = {
  getProcessingQueue,
  getProcessingMaterials,
  updateMaterialStatus,
  createProductionRecord,
  createProductionFromBatch,
  getProductionData,
  getProductionForPOS,
  getProcessingDashboard,
  getProductionById,
  updateProduction,
  deleteProduction,
  exportProductionData,
};