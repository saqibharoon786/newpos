const mongoose = require("mongoose");
const { ProcessingMaterial, ProductionData } = require("../models/process.model.js");
const Purchase = require("../models/pop.model.js");
const Employee = require("../models/employee.model.js");
const { asyncHandler } = require("../utils/asyncHandler");

// Get all processing materials from purchases
const getProcessingMaterials = asyncHandler(async (req, res) => {
  const purchases = await Purchase.find({
    status: "available",
    remainingWeight: { $gt: 0 }
  }).sort({ purchaseDate: -1 });

  const processingMaterials = await Promise.all(purchases.map(async (purchase) => {
    const existingMaterial = await ProcessingMaterial.findOne({ purchaseId: purchase._id });
    
    if (existingMaterial) {
      if (!existingMaterial.code && purchase.code) {
        existingMaterial.code = purchase.code;
        await existingMaterial.save();
      }
      return existingMaterial;
    }

    const newMaterial = new ProcessingMaterial({
      purchaseId: purchase._id,
      receiptNo: purchase.receiptNo || "N/A",
      code: purchase.code || "",
      materialName: purchase.materialName || "Unknown",
      quality: purchase.quality || "Unknown",
      color: purchase.materialColor || "#FFFFFF",
      originalWeight: parseFloat(purchase.weight) || 0,
      availableWeight: purchase.remainingWeight || parseFloat(purchase.weight) || 0,
      vendor: purchase.vendor || "Unknown",
      purchaseDate: purchase.purchaseDate || purchase.createdAt,
      status: "pending",
    });

    return await newMaterial.save();
  }));

  res.status(200).json({
    success: true,
    count: processingMaterials.length,
    data: processingMaterials
  });
});

// Update material status
const updateMaterialStatus = asyncHandler(async (req, res) => {
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

    material = await ProcessingMaterial.create({
      purchaseId: purchase._id,
      receiptNo: purchase.receiptNo || "N/A",
      code: purchase.code || "",
      materialName: purchase.materialName || "Unknown",
      quality: purchase.quality || "Unknown",
      color: purchase.materialColor || "#FFFFFF",
      originalWeight: parseFloat(purchase.weight) || 0,
      availableWeight:
        purchase.remainingWeight || parseFloat(purchase.weight) || 0,
      vendor: purchase.vendor || "Unknown",
      purchaseDate: purchase.purchaseDate || purchase.createdAt,
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
});

// Create production record (used by /production)
const createProductionRecord = asyncHandler(async (req, res) => {
  const productionData = req.body;
  const purchaseId = productionData.purchaseId;
  const weightUsedFromPOP = productionData.weightUsedFromPOP != null ? parseFloat(productionData.weightUsedFromPOP) : null;
  const groupPurchases = productionData.groupPurchases || null; // [{ purchaseId, availableWeight }, ...] for allocating across receipts

  if (weightUsedFromPOP != null && !isNaN(weightUsedFromPOP) && weightUsedFromPOP > 0) {
    if (Array.isArray(groupPurchases) && groupPurchases.length > 0) {
      // Allocate weight used across multiple receipts (same quality+color) so remaining total is correct
      let remainingToAllocate = weightUsedFromPOP;
      for (const item of groupPurchases) {
        if (remainingToAllocate <= 0) break;
        const pid = item.purchaseId;
        const purchase = await Purchase.findById(pid);
        if (!purchase) continue;
        const originalWeight = parseFloat(purchase.weight) || 0;
        const sold = parseFloat(purchase.soldWeight) || 0;
        const currentConsumed = parseFloat(purchase.productionConsumedWeight) || 0;
        const available = Math.max(0, originalWeight - sold - currentConsumed);
        const toDeduct = Math.min(remainingToAllocate, available);
        if (toDeduct > 0) {
          purchase.productionConsumedWeight = currentConsumed + toDeduct;
          await purchase.save();
          
          // Also update ProcessingMaterial if it exists
          await ProcessingMaterial.findOneAndUpdate(
            { purchaseId: purchase._id },
            { availableWeight: purchase.remainingWeight }
          );

          remainingToAllocate -= toDeduct;
        }
      }
    } else if (purchaseId) {
      const purchase = await Purchase.findById(purchaseId);
      if (purchase) {
        const current = parseFloat(purchase.productionConsumedWeight) || 0;
        purchase.productionConsumedWeight = current + weightUsedFromPOP;
        await purchase.save(); // Triggers remainingWeight update

        // Also update ProcessingMaterial if it exists
        await ProcessingMaterial.findOneAndUpdate(
          { purchaseId: purchase._id },
          { availableWeight: purchase.remainingWeight }
        );
      }
    }
  }

  const totalWeight = productionData.totalWeight ?? productionData.outputWeight ?? productionData.machineOutputWeight ?? 0;
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

  const record = new ProductionData({
    ...productionData,
    batchNo,
    code: productionData.code || "",
    productionDate: productionDateValue,
    availableWeight: productionData.availableWeight ?? totalWeight,
    weightUsedFromPOP: weightUsedFromPOP || 0,
    purchaseId: purchaseId || undefined,
  });

  await record.save();

  // Populate employee details
  const populatedRecord = await ProductionData.findById(record._id).populate(
    "employees.employeeId",
    "name employeeId department"
  );

  res.status(201).json({
    success: true,
    data: populatedRecord,
  });
});

// Create production record from old frontend /batches payload
// This keeps your existing process.tsx working without changes.
const createProductionFromBatch = asyncHandler(async (req, res) => {
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
    code: batch.code || "",
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
});

// Get production data
const getProductionData = asyncHandler(async (req, res) => {
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
    return {
      _id: doc._id,
      batchId: doc._id,
      batchNo: doc.batchNo,
      code: doc.code || "",
      materialName: doc.materialName,
      quality: doc.quality,
      color: doc.color,
      outputWeight: doc.totalWeight,
      availableWeight: avail,
      weightUsedFromPOP: doc.weightUsedFromPOP || 0,
      wasteWeight: 0,
      efficiency: 0,
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
});

// Get processing dashboard data
const getProcessingDashboard = asyncHandler(async (req, res) => {
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
});

// Get production by ID
const getProductionById = asyncHandler(async (req, res) => {
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
});

// Update production record
const updateProduction = asyncHandler(async (req, res) => {
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
      const purchase = await Purchase.findById(purchaseId);
      if (purchase) {
        const diff = newUsedFromPOP - oldUsedFromPOP;
        const currentConsumed = parseFloat(purchase.productionConsumedWeight) || 0;
        purchase.productionConsumedWeight = currentConsumed + diff;
        await purchase.save();

        // Also update ProcessingMaterial if it exists
        await ProcessingMaterial.findOneAndUpdate(
          { purchaseId: purchase._id },
          { availableWeight: purchase.remainingWeight }
        );
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
});

// Delete production record
const deleteProduction = asyncHandler(async (req, res) => {
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
  if (production.weightUsedFromPOP > 0 && production.purchaseId) {
    const purchase = await Purchase.findById(production.purchaseId);
    if (purchase) {
      const currentConsumed = parseFloat(purchase.productionConsumedWeight) || 0;
      const restoredWeight = production.weightUsedFromPOP;
      
      // Update purchase consumed weight
      purchase.productionConsumedWeight = Math.max(0, currentConsumed - restoredWeight);
      await purchase.save(); // This will also trigger remainingWeight recalculation

      // Also update ProcessingMaterial if it exists so the queue stays in sync
      const material = await ProcessingMaterial.findOne({ purchaseId: production.purchaseId });
      if (material) {
        material.availableWeight = purchase.remainingWeight;
        // If it was marked processed or in_progress, maybe reset to pending if weight is restored?
        // For now, let's just restore weight.
        await material.save();
      }
    }
  }

  await ProductionData.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: "Production record deleted successfully",
  });
});

// Get production list for POS – aggregated by material+quality+color so dropdown shows total weight (e.g. PP1000 = 1500 kg) not per batch
const getProductionForPOS = asyncHandler(async (req, res) => {
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
    `${d.code || ""}|${d.materialName || ""}|${d.quality || "Standard"}|${(d.color || "#FFFFFF").toString().trim()}`;
  const groups = new Map();
  for (const doc of withAvailable) {
    const key = groupKey(doc);
    const avail = doc.availableWeight ?? doc.totalWeight ?? 0;
    if (!groups.has(key)) {
      groups.set(key, {
        code: doc.code || "",
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
    code: g.code,
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
});

// Export production data
const exportProductionData = asyncHandler(async (req, res) => {
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
});

module.exports = {
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