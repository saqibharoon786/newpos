const mongoose = require("mongoose");
const Sale = require("../models/pos.model");
const Purchase = require("../models/pop.model");
const Customer = require("../models/customer.model");
const Transaction = require("../models/transaction.model");
const { ProductionData } = require("../models/process.model.js");
const { generateSaleInvoiceNo } = require("../utils/invoiceGenerator");
const path = require("path");
const fs = require("fs");

const normStr = (v) => (v == null || v === "" ? "" : String(v).trim());

/** Parse weight from sale field (handles commas / "30 kg" style strings). */
function parseSaleWeight(v) {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

/** FIFO actual cost per kg from oldest production batch for material+quality+color */
async function getFifoActualCostPerKg({ materialName, quality, materialColor }) {
  const qualityQ = String(quality || "Standard").trim();
  const colorC = String(materialColor || "#FFFFFF").trim();
  const productions = await ProductionData.find({
    materialName: String(materialName || "").trim(),
    $or: [{ availableWeight: { $gt: 0 } }, { availableWeight: { $exists: false } }],
  })
    .sort({ productionDate: 1 })
    .lean();
  const match = productions.find(
    (p) =>
      normStr(p.materialName) === normStr(materialName) &&
      normStr(p.quality || "Standard") === normStr(qualityQ) &&
      normStr(p.color || "#FFFFFF") === normStr(colorC) &&
      (p.availableWeight ?? p.totalWeight ?? 0) > 0
  );
  if (!match) return 0;
  const total = parseFloat(match.totalWeight) || 0;
  const cost = parseFloat(match.totalProductionCost) || 0;
  return total > 0 ? Math.round((cost / total) * 100) / 100 : 0;
}

async function recordPosFinanceDeposit({ amount, paymentMethod, invoiceNo, customerName }) {
  if (!amount || amount <= 0) return;
  const raw = String(paymentMethod || "cash").toLowerCase();
  const method = raw === "cash" ? "drawer" : raw;
  if (!["drawer", "easypaisa", "jazzcash", "bank"].includes(method)) return;
  await Transaction.create({
    type: "deposit",
    method,
    amount,
    net: amount,
    description: `Payment received - POS ${invoiceNo} - ${customerName}`,
    reference: invoiceNo,
    status: "completed",
  });
}

async function applyCustomerFinanceAdvance(customerId, amount, invoiceNo) {
  if (!customerId || !amount || amount <= 0) return { ok: true, applied: 0 };
  const customer = await Customer.findById(customerId);
  if (!customer) return { ok: false, message: "Customer not found" };
  const available = customer.financeAdvanceBalance || 0;
  if (available < amount) {
    return {
      ok: false,
      message: `Insufficient advance balance. Available: Rs. ${available}, required: Rs. ${amount}`,
    };
  }
  customer.financeAdvanceBalance = Math.max(0, available - amount);
  customer.advanceLedger = customer.advanceLedger || [];
  customer.advanceLedger.push({
    date: new Date(),
    amount: 0,
    method: "drawer",
    description: `Advance applied to POS invoice ${invoiceNo} (Rs. ${amount})`,
    reference: invoiceNo,
  });
  await customer.save();
  return { ok: true, applied: amount };
}

/** Bill total: pricePerKg × kg − discount + transport; else finalAmount / sellingPrice total. */
function computeSaleBillTotal(body) {
  const kg = parseSaleWeight(body.sellingWeight ?? body.weight);
  const pricePerKg = parseFloat(body.pricePerKg);
  const discount = parseFloat(body.discount) || 0;
  const transport = parseFloat(body.transportationCost) || 0;
  if (!isNaN(pricePerKg) && pricePerKg > 0 && kg > 0) {
    return Math.max(0, Math.round((kg * pricePerKg - discount + transport) * 100) / 100);
  }
  const fromFinal = parseFloat(body.finalAmount);
  if (!isNaN(fromFinal) && fromFinal > 0) return fromFinal;
  const sp = parseFloat(body.sellingPrice) || 0;
  return Math.max(0, Math.round((sp - discount + transport) * 100) / 100);
}

/**
 * Deduct weight from production batches (FIFO, oldest first) — same rules as addSale aggregated path.
 */
async function fifoDeductProduction({ materialName, quality, materialColor }, weightToDeduct) {
  if (weightToDeduct <= 0) return { ok: true };
  const qualityQ = String(quality || "Standard").trim();
  const colorC = String(materialColor || "#FFFFFF").trim();
  const mName = materialName.trim();

  const productions = await ProductionData.find({
    materialName: mName,
    $or: [{ availableWeight: { $gt: 0 } }, { availableWeight: { $exists: false } }],
  })
    .sort({ productionDate: 1 })
    .lean();

  const withAvail = productions.filter((p) => (p.availableWeight ?? p.totalWeight ?? 0) > 0);
  const matching = withAvail.filter(
    (p) =>
      normStr(p.materialName) === normStr(mName) &&
      normStr(p.quality || "Standard") === normStr(qualityQ) &&
      normStr(p.color || "#FFFFFF") === normStr(colorC)
  );

  let totalAvailable = 0;
  for (const p of matching) {
    totalAvailable += p.availableWeight ?? p.totalWeight ?? 0;
  }
  if (weightToDeduct > totalAvailable) {
    return {
      ok: false,
      message: `Cannot increase sale weight. Only ${totalAvailable} kg available across production batches.`,
    };
  }

  let remaining = weightToDeduct;
  for (const p of matching) {
    if (remaining <= 0) break;
    const avail = p.availableWeight ?? p.totalWeight ?? 0;
    const deduct = Math.min(remaining, avail);
    if (deduct <= 0) continue;
    const prod = await ProductionData.findById(p._id);
    if (!prod) continue;
    const newAvail = (prod.availableWeight ?? prod.totalWeight ?? 0) - deduct;
    prod.availableWeight = Math.max(0, newAvail);
    await prod.save();
    remaining -= deduct;
  }
  if (remaining > 0) {
    return { ok: false, message: "Insufficient production stock for this weight change." };
  }
  return { ok: true };
}

/**
 * Return weight to production batches (newest first; cap each batch at totalWeight).
 */
async function fifoReturnProduction({ materialName, quality, materialColor }, weightToReturn) {
  if (weightToReturn <= 0) return { ok: true };
  const qualityQ = String(quality || "Standard").trim();
  const colorC = String(materialColor || "#FFFFFF").trim();
  const mName = materialName.trim();

  const productions = await ProductionData.find({ materialName: mName })
    .sort({ productionDate: -1 })
    .lean();

  const matching = productions.filter(
    (p) =>
      normStr(p.materialName) === normStr(mName) &&
      normStr(p.quality || "Standard") === normStr(qualityQ) &&
      normStr(p.color || "#FFFFFF") === normStr(colorC)
  );

  let remaining = weightToReturn;
  for (const p of matching) {
    if (remaining <= 0) break;
    const prod = await ProductionData.findById(p._id);
    if (!prod) continue;
    const curAvail = prod.availableWeight ?? prod.totalWeight ?? 0;
    const total = prod.totalWeight ?? 0;
    const room = Math.max(0, total - curAvail);
    const toAdd = Math.min(remaining, room);
    if (toAdd > 0) {
      prod.availableWeight = curAvail + toAdd;
      await prod.save();
      remaining -= toAdd;
    }
  }
  if (remaining > 0) {
    return {
      ok: false,
      message:
        "Cannot decrease sale weight by that amount — stock return could not be applied to production batches. Check data consistency.",
    };
  }
  return { ok: true };
}

// ➕ Add Sale (with optional receipt image)
// Supports sale from POP purchase (purchaseId) OR from Production List (productionId)
const addSale = async (req, res) => {
  try {
    const {
      purchaseId,
      productionId,
      customerName,
      customerPhone,
      customerEmail,
      sellingPrice,
      sellingWeight,
      saleDate,
      paymentMethod,
      paymentStatus,
      amountPaid = 0,
      invoiceNo,
      transportationCost,
      notes,
      materialName: bodyMaterialName,
      supplierName: bodySupplierName,
      quality: bodyQuality,
      materialColor: bodyMaterialColor,
      actualPrice: bodyActualPrice,
      unit: requestUnit,
    } = req.body;

    if (!customerName || !sellingPrice || !sellingWeight) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing: customerName, sellingPrice, sellingWeight"
      });
    }

    const finalInvoiceNo = invoiceNo || (await generateSaleInvoiceNo());
    const dup = await Sale.findOne({ invoiceNo: finalInvoiceNo });
    if (dup) {
      return res.status(409).json({
        success: false,
        message: `Duplicate invoice number: ${finalInvoiceNo}`,
      });
    }
    if (productionId && purchaseId) {
      return res.status(400).json({
        success: false,
        message: "Provide either purchaseId or productionId, not both"
      });
    }
    const fromAggregatedProduction = !productionId && !purchaseId && bodyMaterialName && bodyMaterialName.trim() !== "";
    if (!productionId && !purchaseId && !fromAggregatedProduction) {
      return res.status(400).json({
        success: false,
        message: "Required: purchaseId (POP), productionId (single batch), or materialName+quality+materialColor (aggregated Production)"
      });
    }

    const weightToSell = parseFloat(sellingWeight);
    if (isNaN(weightToSell) || weightToSell <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid selling weight is required"
      });
    }

    const receiptImage = req.file ? `/uploads/receipts/${req.file.filename}` : "";
    const paidAmount = parseFloat(amountPaid) || 0;
    const discountNum = parseFloat(req.body.discount) || 0;
    const sellingPriceNum = computeSaleBillTotal({
      ...req.body,
      sellingWeight: weightToSell,
    });
    if (paidAmount > sellingPriceNum) {
      return res.status(400).json({
        success: false,
        message: `Received amount (${paidAmount}) cannot exceed total bill (${sellingPriceNum})`,
      });
    }
    const remainingAmount = Math.max(0, sellingPriceNum - paidAmount);
    const billTotalStr = String(sellingPriceNum);
    const transportNum = parseFloat(transportationCost) || 0;
    const pricePerKgBody = parseFloat(req.body.pricePerKg);
    const sellingPricePerKg =
      !isNaN(pricePerKgBody) && pricePerKgBody > 0
        ? pricePerKgBody
        : weightToSell > 0
          ? Math.round(((sellingPriceNum + discountNum - transportNum) / weightToSell) * 100) / 100
          : 0;
    let finalPaymentStatus = paymentStatus;
    if (!finalPaymentStatus) {
      if (paidAmount === 0) finalPaymentStatus = 'none';
      else if (paidAmount >= sellingPriceNum) finalPaymentStatus = 'paid';
      else finalPaymentStatus = 'partial';
    }

    let materialName, supplierName, materialColor, actualPrice, salePayload;

    if (productionId) {
      // Sale from single Production batch
      const production = await ProductionData.findById(productionId);
      if (!production) {
        return res.status(404).json({
          success: false,
          message: "Production record not found"
        });
      }
      const available = production.availableWeight ?? production.totalWeight ?? 0;
      if (weightToSell > available) {
        return res.status(400).json({
          success: false,
          message: `Cannot sell ${weightToSell}kg. Only ${available}kg available for this production.`
        });
      }
      const newAvailable = available - weightToSell;
      production.availableWeight = newAvailable;
      await production.save();

      materialName = bodyMaterialName || production.materialName;
      supplierName = bodySupplierName || "Production";
      const quality = bodyQuality || production.quality || "";
      materialColor = bodyMaterialColor || production.color || "";
      actualPrice = bodyActualPrice || "0";

      salePayload = {
        productionId: production._id,
        purchaseId: undefined,
        materialName,
        supplierName,
        quality,
        invoiceNo: finalInvoiceNo,
        weight: sellingWeight.toString(),
        unit: (requestUnit !== undefined && requestUnit !== null && String(requestUnit).trim() !== "") ? String(requestUnit).trim() : "0",
        purchaseDate: saleDate ? (typeof saleDate === 'string' && saleDate.includes('T') ? saleDate.split('T')[0] : saleDate) : new Date().toISOString().split('T')[0],
        purchaseTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        branch: "Main",
        materialColor,
        actualPrice,
        productionCost: String(production.totalProductionCost || production.materialCost || 0),
        costPerKg: weightToSell > 0 ? (production.totalProductionCost || 0) / weightToSell : 0,
        sellingPrice: billTotalStr,
        sellingPricePerKg,
        discount: String(discountNum),
        finalAmount: billTotalStr,
        advancePayment: paidAmount,
        amountPaid: paidAmount,
        remainingAmount: remainingAmount,
        paymentStatus: finalPaymentStatus,
        buyerName: customerName,
        buyerAddress: "",
        buyerPhone: customerPhone || "",
        buyerEmail: customerEmail || "",
        buyerCnic: "",
        buyerCompany: "",
        receiptImage,
        transportationCost: transportationCost || 0,
        notes: notes || ""
      };
    } else if (fromAggregatedProduction) {
      // Sale from aggregated Production (FIFO): deduct from batches by materialName + quality + color
      const quality = (bodyQuality || "Standard").toString().trim();
      const color = (bodyMaterialColor || "#FFFFFF").toString().trim();
      const productions = await ProductionData.find({
        materialName: bodyMaterialName.trim(),
        $or: [
          { availableWeight: { $gt: 0 } },
          { availableWeight: { $exists: false } },
        ],
      })
        .sort({ productionDate: 1 })
        .lean();
      const withAvail = productions.filter(
        (p) => (p.availableWeight ?? p.totalWeight ?? 0) > 0
      );
      const norm = (v) => (v == null || v === "" ? "" : String(v).trim());
      const matching = withAvail.filter(
        (p) =>
          norm(p.materialName) === norm(bodyMaterialName) &&
          norm(p.quality || "Standard") === norm(quality) &&
          norm(p.color || "#FFFFFF") === norm(color)
      );
      let totalAvailable = 0;
      for (const p of matching) {
        totalAvailable += p.availableWeight ?? p.totalWeight ?? 0;
      }
      if (weightToSell > totalAvailable) {
        return res.status(400).json({
          success: false,
          message: `Cannot sell ${weightToSell}kg. Only ${totalAvailable}kg available for ${bodyMaterialName} (${quality}).`
        });
      }
      let remaining = weightToSell;
      let firstProductionId = null;
      for (const p of matching) {
        if (remaining <= 0) break;
        const avail = p.availableWeight ?? p.totalWeight ?? 0;
        const deduct = Math.min(remaining, avail);
        if (deduct <= 0) continue;
        const prod = await ProductionData.findById(p._id);
        if (!prod) continue;
        const newAvail = (prod.availableWeight ?? prod.totalWeight ?? 0) - deduct;
        prod.availableWeight = Math.max(0, newAvail);
        await prod.save();
        if (firstProductionId == null) firstProductionId = prod._id;
        remaining -= deduct;
      }
      materialName = bodyMaterialName.trim();
      supplierName = bodySupplierName || "Production";
      materialColor = color;
      actualPrice = bodyActualPrice || "0";
      salePayload = {
        productionId: firstProductionId || undefined,
        purchaseId: undefined,
        materialName,
        supplierName,
        quality,
        invoiceNo: finalInvoiceNo,
        weight: sellingWeight.toString(),
        unit: (requestUnit !== undefined && requestUnit !== null && String(requestUnit).trim() !== "") ? String(requestUnit).trim() : "0",
        purchaseDate: saleDate ? (typeof saleDate === 'string' && saleDate.includes('T') ? saleDate.split('T')[0] : saleDate) : new Date().toISOString().split('T')[0],
        purchaseTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        branch: "Main",
        materialColor,
        actualPrice,
        productionCost: "0",
        sellingPrice: billTotalStr,
        sellingPricePerKg,
        discount: String(discountNum),
        finalAmount: billTotalStr,
        advancePayment: paidAmount,
        amountPaid: paidAmount,
        remainingAmount: remainingAmount,
        paymentStatus: finalPaymentStatus,
        buyerName: customerName,
        buyerAddress: "",
        buyerPhone: customerPhone || "",
        buyerEmail: customerEmail || "",
        buyerCnic: "",
        buyerCompany: "",
        receiptImage,
        transportationCost: transportationCost || 0,
        notes: notes || ""
      };
    } else {
      // Sale from POP purchase
      const purchase = await Purchase.findById(purchaseId);
      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: "Purchase not found"
        });
      }
      const originalWeight = parseFloat(purchase.weight) || 0;
      const currentSoldWeight = parseFloat(purchase.soldWeight) || 0;
      const currentRemainingWeight = originalWeight - currentSoldWeight;

      if (weightToSell > currentRemainingWeight) {
        return res.status(400).json({
          success: false,
          message: `Cannot sell ${weightToSell}kg. Only ${currentRemainingWeight}kg available.`
        });
      }
      const newSoldWeight = currentSoldWeight + weightToSell;
      const newRemainingWeight = originalWeight - newSoldWeight;
      purchase.soldWeight = newSoldWeight;
      purchase.remainingWeight = newRemainingWeight;
      if (newRemainingWeight === 0) purchase.status = 'sold_out';
      else if (newRemainingWeight < originalWeight) purchase.status = 'partially_sold';
      else purchase.status = 'available';
      await purchase.save();

      materialName = purchase.materialName;
      supplierName = purchase.vendor || purchase.supplierName || "";
      const quality = bodyQuality || purchase.quality || "";
      materialColor = purchase.materialColor || "";
      actualPrice = purchase.price || "0";

      salePayload = {
        purchaseId: purchase._id,
        productionId: undefined,
        materialName,
        supplierName,
        quality,
        invoiceNo: finalInvoiceNo,
        weight: sellingWeight.toString(),
        unit: (requestUnit !== undefined && requestUnit !== null && String(requestUnit).trim() !== "") ? String(requestUnit).trim() : (purchase.unit || "0"),
        purchaseDate: saleDate ? (typeof saleDate === 'string' && saleDate.includes('T') ? saleDate.split('T')[0] : saleDate) : new Date().toISOString().split('T')[0],
        purchaseTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        branch: "Main",
        materialColor,
        actualPrice,
        productionCost: "0",
        sellingPrice: billTotalStr,
        sellingPricePerKg,
        discount: String(discountNum),
        finalAmount: billTotalStr,
        advancePayment: paidAmount,
        amountPaid: paidAmount,
        remainingAmount: remainingAmount,
        paymentStatus: finalPaymentStatus,
        buyerName: customerName,
        buyerAddress: "",
        buyerPhone: customerPhone || "",
        buyerEmail: customerEmail || "",
        buyerCnic: "",
        buyerCompany: "",
        receiptImage,
        transportationCost: transportationCost || 0,
        notes: notes || ""
      };
    }

    salePayload.invoiceNo = finalInvoiceNo;
    salePayload.paymentMethod = paymentMethod || 'cash';
    salePayload.customerId = req.body.customerId;
    salePayload.approvalStatus = 'pending';
    salePayload.createdBy = req.user?.username || req.body.createdBy || 'system';
    salePayload.transportationCost = transportNum;
    salePayload.notes = notes || '';

    const matForCost = salePayload.materialName || bodyMaterialName;
    const qualForCost = salePayload.quality || bodyQuality;
    const colorForCost = salePayload.materialColor || bodyMaterialColor;
    if (matForCost) {
      const fifoCost = await getFifoActualCostPerKg({
        materialName: matForCost,
        quality: qualForCost,
        materialColor: colorForCost,
      });
      if (fifoCost > 0) {
        salePayload.actualCostPerKg = fifoCost;
        if (!salePayload.costPerKg || salePayload.costPerKg === 0) {
          salePayload.costPerKg = fifoCost;
        }
      }
    }

    if (req.body.customerId) {
      const cust = await Customer.findById(req.body.customerId).lean();
      if (cust) {
        const profileDue = Math.max(0, (cust.amount || 0) - (cust.amountPaid || 0));
        const saleDueAgg = await Sale.aggregate([
          { $match: { customerId: cust._id } },
          { $group: { _id: null, due: { $sum: { $ifNull: ['$remainingAmount', 0] } } } },
        ]);
        const salesDue = saleDueAgg[0]?.due || 0;
        salePayload.customerBalanceAtSale = Math.round((profileDue + salesDue) * 100) / 100;
        salePayload.financeAdvanceAtSale = Math.round((cust.financeAdvanceBalance || 0) * 100) / 100;
      }
    }

    const payMethod = String(paymentMethod || 'cash').toLowerCase();
    if (payMethod === 'advance' && paidAmount > 0 && req.body.customerId) {
      const adv = await applyCustomerFinanceAdvance(req.body.customerId, paidAmount, finalInvoiceNo);
      if (!adv.ok) {
        return res.status(400).json({ success: false, message: adv.message });
      }
    } else if (paidAmount > 0) {
      await recordPosFinanceDeposit({
        amount: paidAmount,
        paymentMethod: payMethod,
        invoiceNo: finalInvoiceNo,
        customerName,
      });
    }

    let parsedLineItems = req.body.lineItems;
    if (typeof parsedLineItems === 'string') {
      try {
        parsedLineItems = JSON.parse(parsedLineItems);
      } catch {
        parsedLineItems = [];
      }
    }
    if (Array.isArray(parsedLineItems) && parsedLineItems.length > 0) {
      salePayload.lineItems = parsedLineItems.map((li) => ({
        materialName: li.materialName,
        quality: li.quality || 'Standard',
        materialColor: li.materialColor || '#FFFFFF',
        weight: parseFloat(li.weight) || 0,
        sellingPricePerKg: parseFloat(li.sellingPricePerKg) || 0,
        discount: parseFloat(li.discount) || 0,
        transportationCost: parseFloat(li.transportationCost) || 0,
        amount: parseFloat(li.amount) || 0,
        actualCostPerKg: parseFloat(li.actualCostPerKg) || 0,
        productionId: li.productionId,
      }));
    }

    const sale = await Sale.create(salePayload);

    res.status(201).json({
      success: true,
      message: "Sale completed successfully",
      data: {
        sale,
        paymentSummary: {
          amountPaid: paidAmount,
          remainingAmount: remainingAmount,
          paymentStatus: finalPaymentStatus
        }
      }
    });
  } catch (error) {
    console.error('Sale error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate invoice number' });
    }
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};

// 📥 Get All Sales
const getSales = async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    
    // Add full URL to receiptImage if it exists
    const salesWithFullUrls = sales.map(sale => {
      const saleObj = sale.toObject();
      if (saleObj.receiptImage && saleObj.receiptImage.trim() !== '') {
        saleObj.receiptImage = `${req.protocol}://${req.get('host')}${saleObj.receiptImage}`;
      }
      return saleObj;
    });
    
    res.status(200).json({ success: true, data: salesWithFullUrls });
  } catch (error) {
    console.error('Error in getSales:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📄 Get Sale by ID
const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sale ID",
      });
    }

    const sale = await Sale.findById(id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Add full URL to receiptImage if it exists
    const saleObj = sale.toObject();
    if (saleObj.receiptImage && saleObj.receiptImage.trim() !== '') {
      saleObj.receiptImage = `${req.protocol}://${req.get('host')}${saleObj.receiptImage}`;
    }

    res.status(200).json({ success: true, data: saleObj });

  } catch (error) {
    console.error('Error in getSaleById:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✏️ Update Sale
const updateSale = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("=== UPDATE SALE REQUEST ===");
    console.log("Request file:", req.file);
    console.log("Request body:", req.body);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sale ID",
      });
    }

    // Check if sale exists
    const existingSale = await Sale.findById(id);
    if (!existingSale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Prepare update data
    const updateData = { ...req.body };

    // Align with add-sale API: frontend sends sellingWeight; Sale model uses weight
    if (updateData.sellingWeight !== undefined && updateData.weight === undefined) {
      updateData.weight = String(updateData.sellingWeight);
    }
    delete updateData.sellingWeight;

    // Form uses customerName; Sale model uses buyerName
    if (updateData.customerName !== undefined) {
      updateData.buyerName = updateData.customerName;
      delete updateData.customerName;
    }
    if (updateData.customerPhone !== undefined) {
      updateData.buyerPhone = updateData.customerPhone;
      delete updateData.customerPhone;
    }
    if (updateData.customerEmail !== undefined) {
      updateData.buyerEmail = updateData.customerEmail;
      delete updateData.customerEmail;
    }

    // Add-sale sends saleDate (ISO); Sale model stores purchaseDate (YYYY-MM-DD) + purchaseTime
    if (updateData.saleDate !== undefined && String(updateData.saleDate).trim() !== "") {
      const sd = String(updateData.saleDate).trim();
      const d = new Date(sd);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        updateData.purchaseDate = `${y}-${m}-${day}`;
        let hour = d.getHours();
        const minute = String(d.getMinutes()).padStart(2, "0");
        const ampm = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        updateData.purchaseTime = `${hour12.toString().padStart(2, "0")}:${minute} ${ampm}`;
      }
      delete updateData.saleDate;
    }

    const oldWeight = parseSaleWeight(existingSale.weight);
    let newWeight = oldWeight;
    if (updateData.weight !== undefined) {
      newWeight = parseSaleWeight(updateData.weight);
    }
    const weightDelta = newWeight - oldWeight;

    const salePurchaseId = existingSale.purchaseId;

    // Handle receipt image
    if (req.file) {
      console.log("New file uploaded:", req.file.filename);
      
      // Delete old receipt image if exists
      if (existingSale.receiptImage && existingSale.receiptImage.trim() !== '') {
        const oldImagePath = path.join(process.env.UPLOAD_PATH || "./uploads", existingSale.receiptImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      // Save new receipt image path
      updateData.receiptImage = `/receipts/${req.file.filename}`;
    } else if (req.body.removeReceipt === 'true') {
      // Remove receipt image
      if (existingSale.receiptImage && existingSale.receiptImage.trim() !== '') {
        const oldImagePath = path.join(process.env.UPLOAD_PATH || "./uploads", existingSale.receiptImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updateData.receiptImage = "";
    }

    if (
      updateData.sellingPrice ||
      updateData.pricePerKg ||
      updateData.discount ||
      updateData.transportationCost ||
      updateData.weight ||
      updateData.sellingWeight
    ) {
      const billTotal = computeSaleBillTotal({
        ...existingSale.toObject(),
        ...updateData,
        sellingWeight: updateData.weight ?? updateData.sellingWeight ?? existingSale.weight,
      });
      updateData.sellingPrice = String(billTotal);
      updateData.finalAmount = String(billTotal);
      const pkg = parseFloat(updateData.pricePerKg);
      const discUpd = parseFloat(updateData.discount);
      const discN = !isNaN(discUpd) ? discUpd : parseFloat(existingSale.discount) || 0;
      const transpUpd = parseFloat(updateData.transportationCost);
      const transpN = !isNaN(transpUpd) ? transpUpd : parseFloat(existingSale.transportationCost) || 0;
      if (!isNaN(pkg) && pkg > 0) {
        updateData.sellingPricePerKg = pkg;
      } else if (newWeight > 0) {
        updateData.sellingPricePerKg =
          Math.round(((billTotal + discN - transpN) / newWeight) * 100) / 100;
      }
      const paid = parseFloat(updateData.amountPaid) ?? existingSale.amountPaid ?? 0;
      if (paid > billTotal) {
        return res.status(400).json({
          success: false,
          message: `Received amount (${paid}) cannot exceed total bill (${billTotal})`,
        });
      }
      updateData.remainingAmount = Math.max(0, billTotal - paid);
    }

    // Handle advance payment
    if (updateData.advancePayment !== undefined) {
      updateData.advancePayment = parseFloat(updateData.advancePayment) || 0;
    }

    // Sync POP / production stock when sale weight changes (mirrors addSale deductions)
    if (weightDelta !== 0) {
      if (newWeight <= 0) {
        return res.status(400).json({
          success: false,
          message: "Sale weight must be greater than zero.",
        });
      }

      if (salePurchaseId) {
        const purchase = await Purchase.findById(salePurchaseId);
        if (!purchase) {
          return res.status(400).json({
            success: false,
            message: "Linked purchase record not found; cannot adjust stock.",
          });
        }
        const originalWeight = parseFloat(purchase.weight) || 0;
        const currentSoldWeight = parseFloat(purchase.soldWeight) || 0;
        const newSoldWeight = currentSoldWeight + weightDelta;
        if (newSoldWeight < 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid weight change for purchase stock.",
          });
        }
        if (newSoldWeight > originalWeight) {
          return res.status(400).json({
            success: false,
            message: `Cannot increase sale weight beyond available purchase stock (${originalWeight} kg total).`,
          });
        }
        purchase.soldWeight = newSoldWeight;
        await purchase.save();
      } else {
        const materialName =
          updateData.materialName !== undefined ? updateData.materialName : existingSale.materialName;
        const quality =
          updateData.quality !== undefined ? updateData.quality : existingSale.quality;
        const materialColor =
          updateData.materialColor !== undefined ? updateData.materialColor : existingSale.materialColor;

        if (!materialName || !String(materialName).trim()) {
          return res.status(400).json({
            success: false,
            message: "Cannot adjust production stock: material name missing on this sale.",
          });
        }

        if (weightDelta > 0) {
          const r = await fifoDeductProduction(
            { materialName, quality, materialColor },
            weightDelta
          );
          if (!r.ok) {
            return res.status(400).json({ success: false, message: r.message });
          }
        } else {
          const r = await fifoReturnProduction(
            { materialName, quality, materialColor },
            Math.abs(weightDelta)
          );
          if (!r.ok) {
            return res.status(400).json({ success: false, message: r.message });
          }
        }
      }
    }

    const oldPaid = Number(existingSale.amountPaid) || 0;
    const newPaid =
      updateData.amountPaid !== undefined
        ? parseFloat(updateData.amountPaid) || 0
        : oldPaid;

    const sale = await Sale.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (newPaid > oldPaid) {
      const delta = Math.round((newPaid - oldPaid) * 100) / 100;
      const payMethod = String(
        updateData.paymentMethod || existingSale.paymentMethod || 'cash'
      ).toLowerCase();
      if (payMethod !== 'advance' && delta > 0) {
        await recordPosFinanceDeposit({
          amount: delta,
          paymentMethod: payMethod,
          invoiceNo: existingSale.invoiceNo || id,
          customerName: existingSale.buyerName || 'Customer',
        });
      }
    }

    // Add full URL to receiptImage for response
    const saleObj = sale.toObject();
    if (saleObj.receiptImage && saleObj.receiptImage.trim() !== '') {
      saleObj.receiptImage = `${req.protocol}://${req.get('host')}${saleObj.receiptImage}`;
    }

    res.status(200).json({
      success: true,
      message: "Sale updated successfully",
      data: saleObj,
    });
  } catch (error) {
    console.error('Error in updateSale:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🗑 Delete Sale
const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sale ID",
      });
    }

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Delete receipt image if exists
    if (sale.receiptImage && sale.receiptImage.trim() !== '') {
      const imagePath = path.join(process.env.UPLOAD_PATH || "./uploads", sale.receiptImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Sale.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "Sale deleted successfully",
    });
  } catch (error) {
    console.error('Error in deleteSale:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🔍 Get all sales by material name (for POP integration)
const getSalesByMaterial = async (req, res) => {
  try {
    const { materialName } = req.params;
    
    const sales = await Sale.find({ materialName }).sort({ createdAt: -1 });
    
    // Calculate total sold weight
    let totalSoldWeight = 0;
    sales.forEach(sale => {
      totalSoldWeight += parseFloat(sale.weight) || 0;
    });
    
    // Add full URL to receiptImage if it exists
    const salesWithFullUrls = sales.map(sale => {
      const saleObj = sale.toObject();
      if (saleObj.receiptImage && saleObj.receiptImage.trim() !== '') {
        saleObj.receiptImage = `${req.protocol}://${req.get('host')}${saleObj.receiptImage}`;
      }
      return saleObj;
    });
    
    res.status(200).json({ 
      success: true, 
      data: salesWithFullUrls,
      totalSoldWeight,
      salesCount: sales.length
    });
  } catch (error) {
    console.error('Error in getSalesByMaterial:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 📊 Get total sold weight by material
const getTotalSoldWeightByMaterial = async (req, res) => {
  try {
    const { materialName } = req.params;
    
    const sales = await Sale.find({ materialName });
    
    let totalSoldWeight = 0;
    sales.forEach(sale => {
      totalSoldWeight += parseFloat(sale.weight) || 0;
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalSoldWeight,
        salesCount: sales.length
      }
    });
  } catch (error) {
    console.error('Error in getTotalSoldWeightByMaterial:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 📈 Get sales statistics
const getSalesStatistics = async (req, res) => {
  try {
    const totalSales = await Sale.countDocuments();
    const totalWeight = await Sale.aggregate([
      {
        $group: {
          _id: null,
          totalWeight: { 
            $sum: { 
              $convert: { input: "$weight", to: "double", onError: 0 } 
            }
          }
        }
      }
    ]);
    
    const totalAdvancePayment = await Sale.aggregate([
      {
        $group: {
          _id: null,
          totalAdvance: { $sum: "$advancePayment" }
        }
      }
    ]);
    
    const totalRevenue = await Sale.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { 
            $sum: { 
              $convert: { input: "$finalAmount", to: "double", onError: 0 } 
            }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalSales,
        totalWeight: totalWeight[0]?.totalWeight || 0,
        totalAdvancePayment: totalAdvancePayment[0]?.totalAdvance || 0,
        totalRevenue: totalRevenue[0]?.totalRevenue || 0,
      }
    });
  } catch (error) {
    console.error('Error in getSalesStatistics:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

const getNextSaleInvoiceNo = async (req, res) => {
  try {
    const invoiceNo = await generateSaleInvoiceNo();
    res.status(200).json({ success: true, data: { invoiceNo } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const approveSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ success: false, message: 'Not found' });
    sale.approvalStatus = 'approved';
    await sale.save();
    res.json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  addSale,
  getNextSaleInvoiceNo,
  getSales,
  getSaleById,
  updateSale,
  deleteSale,
  getSalesByMaterial,
  getTotalSoldWeightByMaterial,
  getSalesStatistics,
  approveSale,
};