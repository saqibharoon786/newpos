const mongoose = require("mongoose");
const Sale = require("../models/pos.model");
const Purchase = require("../models/pop.model");
const Customer = require("../models/customer.model");
const Transaction = require("../models/transaction.model");
const { ProductionData } = require("../models/process.model.js");
const { generateSaleInvoiceNo } = require("../utils/invoiceGenerator");
const { assertBillNoUnique } = require("../utils/billNumber");
const Expense = require("../models/expense.model");
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

function round2(n) {
  return Math.round(n * 100) / 100;
}

function normalizePosPaymentMethod(method) {
  const raw = String(method || 'cash').toLowerCase();
  if (raw === 'cash') return 'drawer';
  if (['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(raw)) return raw;
  return 'drawer';
}

async function recordPosFinanceDeposit({
  amount,
  paymentMethod,
  invoiceNo,
  customerName,
  customerId,
  transactionDate,
}) {
  if (!amount || amount <= 0) return null;
  const method = normalizePosPaymentMethod(paymentMethod);
  if (!['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(method)) return null;
  const date =
    transactionDate && !Number.isNaN(new Date(transactionDate).getTime())
      ? new Date(transactionDate)
      : new Date();
  return Transaction.create({
    type: 'deposit',
    method,
    amount,
    net: amount,
    description: `Payment received - POS ${invoiceNo} - ${customerName}`,
    reference: invoiceNo,
    status: 'completed',
    date,
    partyType: customerId ? 'customer' : undefined,
    partyId: customerId || undefined,
    partyName: customerName || undefined,
    category: 'pos_payment',
  });
}

function parsePosPaymentDate(input) {
  if (!input) return new Date();
  const direct = new Date(input);
  if (!Number.isNaN(direct.getTime())) return direct;

  const ymd = String(input).trim();
  const isoDate = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    return new Date(
      parseInt(isoDate[1], 10),
      parseInt(isoDate[2], 10) - 1,
      parseInt(isoDate[3], 10),
      12,
      0,
      0
    );
  }

  const dmy = ymd.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) {
    return new Date(
      parseInt(dmy[3], 10),
      parseInt(dmy[2], 10) - 1,
      parseInt(dmy[1], 10),
      12,
      0,
      0
    );
  }

  return new Date();
}

function resolvePosFinancePaymentDate({ saleDate, purchaseDate, paymentDate }) {
  if (paymentDate) return parsePosPaymentDate(paymentDate);
  if (saleDate) return parsePosPaymentDate(saleDate);
  if (purchaseDate) return parsePosPaymentDate(purchaseDate);
  return new Date();
}

/** Sale form date/time → stored purchaseDate, purchaseTime, and Finance transaction date */
function splitSaleDateTime(saleDate) {
  if (!saleDate) {
    const now = new Date();
    return {
      purchaseDate: now.toISOString().split('T')[0],
      purchaseTime: now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
      paymentDate: now,
    };
  }

  const parsed = new Date(saleDate);
  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    const hours = String(parsed.getHours()).padStart(2, '0');
    const mins = String(parsed.getMinutes()).padStart(2, '0');
    return {
      purchaseDate: `${yyyy}-${mm}-${dd}`,
      purchaseTime: `${hours}:${mins}`,
      paymentDate: parsed,
    };
  }

  const dateOnly = String(saleDate).trim();
  return {
    purchaseDate: dateOnly.includes('T') ? dateOnly.split('T')[0] : dateOnly,
    purchaseTime: new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }),
    paymentDate: parsePosPaymentDate(dateOnly),
  };
}

function buildPaymentLedgerEntry({
  amount,
  paymentDate,
  paymentMethod,
  notes,
  clientPaymentId,
  transactionId,
}) {
  const d = paymentDate ? new Date(paymentDate) : new Date();
  const raw = String(paymentMethod || 'cash').toLowerCase();
  const methodEnum = ['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(
    normalizePosPaymentMethod(paymentMethod)
  )
    ? normalizePosPaymentMethod(paymentMethod)
    : raw === 'other'
      ? 'other'
      : 'cash';
  return {
    date: Number.isNaN(d.getTime()) ? new Date() : d,
    amount: round2(amount),
    method: methodEnum,
    notes: notes || '',
    clientPaymentId: clientPaymentId || '',
    transactionId: transactionId || undefined,
  };
}

/** How much customer finance advance to apply on a new POS bill (mirrors POP vendor advance). */
function resolveAdvanceForSale(customer, billTotal, requestedAdvance) {
  const price = parseFloat(billTotal) || 0;
  const available = Math.max(0, Number(customer?.financeAdvanceBalance) || 0);
  if (price <= 0 || available <= 0) return 0;
  const requested = parseFloat(requestedAdvance);
  if (requestedAdvance === 0 || requested === 0) return 0;
  if (isNaN(requested) || requested < 0) return Math.min(available, price);
  return Math.min(requested, available, price);
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
  await customer.save();
  return { ok: true, applied: amount };
}

function parseLineItemsFromBody(body) {
  let items = body?.lineItems;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  if (!Array.isArray(items)) return [];
  return items
    .map((li) => {
      const weight = parseFloat(li.weight) || 0;
      const rate = parseFloat(li.sellingPricePerKg) || 0;
      const lineDiscount = parseFloat(li.discount) || 0;
      const lineTransport = parseFloat(li.transportationCost) || 0;
      let amount = parseFloat(li.amount) || 0;
      if (amount <= 0 && weight > 0 && rate > 0) {
        amount = Math.max(0, round2(weight * rate - lineDiscount + lineTransport));
      }
      return {
        materialName: String(li.materialName || '').trim(),
        quality: String(li.quality || 'Standard').trim(),
        materialColor: String(li.materialColor || '#FFFFFF').trim(),
        weight,
        sellingPricePerKg: rate,
        discount: lineDiscount,
        transportationCost: lineTransport,
        amount,
        actualCostPerKg: parseFloat(li.actualCostPerKg) || 0,
        productionId: li.productionId || undefined,
      };
    })
    .filter((li) => li.materialName && li.weight > 0);
}

function sumLineItemsAmount(lineItems) {
  return round2(lineItems.reduce((sum, li) => sum + (li.amount || 0), 0));
}

async function enrichLineItemsWithCost(lineItems) {
  return Promise.all(
    lineItems.map(async (li) => {
      const fifoCost = await getFifoActualCostPerKg({
        materialName: li.materialName,
        quality: li.quality,
        materialColor: li.materialColor,
      });
      return {
        materialName: li.materialName,
        quality: li.quality,
        materialColor: li.materialColor,
        weight: li.weight,
        sellingPricePerKg: li.sellingPricePerKg,
        discount: li.discount,
        transportationCost: 0,
        amount: li.amount,
        actualCostPerKg: li.actualCostPerKg > 0 ? li.actualCostPerKg : fifoCost,
        productionId: li.productionId,
      };
    })
  );
}

/** Bill total: sum line items when present; else pricePerKg × kg − discount + transport. */
function computeSaleBillTotal(body) {
  const lineItems = parseLineItemsFromBody(body);
  const discount = parseFloat(body.discount) || 0;
  const transport = parseFloat(body.transportationCost) || 0;

  if (lineItems.length > 0) {
    return Math.max(0, round2(sumLineItemsAmount(lineItems) - discount + transport));
  }

  const kg = parseSaleWeight(body.sellingWeight ?? body.weight);
  const pricePerKg = parseFloat(body.pricePerKg);
  if (!isNaN(pricePerKg) && pricePerKg > 0 && kg > 0) {
    return Math.max(0, round2(kg * pricePerKg - discount + transport));
  }
  const fromFinal = parseFloat(body.finalAmount);
  if (!isNaN(fromFinal) && fromFinal > 0) return fromFinal;
  const sp = parseFloat(body.sellingPrice) || 0;
  return Math.max(0, round2(sp - discount + transport));
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

/** Reverse stock when a POS sale is deleted (POP soldWeight or production FIFO). */
async function restoreSaleStock(sale) {
  if (Array.isArray(sale.lineItems) && sale.lineItems.length > 0) {
    for (const li of sale.lineItems) {
      const lineWeight = parseFloat(li.weight) || 0;
      if (lineWeight <= 0) continue;
      const result = await fifoReturnProduction(
        {
          materialName: li.materialName,
          quality: li.quality,
          materialColor: li.materialColor,
        },
        lineWeight
      );
      if (!result.ok) return result;
    }
    return { ok: true };
  }

  const weight = parseSaleWeight(sale.weight);
  if (weight <= 0) return { ok: true };

  if (sale.purchaseId) {
    const purchase = await Purchase.findById(sale.purchaseId);
    if (!purchase) return { ok: true };

    const originalWeight = parseFloat(purchase.weight) || 0;
    const currentSoldWeight = parseFloat(purchase.soldWeight) || 0;
    const newSoldWeight = Math.max(0, currentSoldWeight - weight);
    purchase.soldWeight = newSoldWeight;
    purchase.remainingWeight = Math.max(0, originalWeight - newSoldWeight);

    if (newSoldWeight <= 0) purchase.status = 'available';
    else if (purchase.remainingWeight <= 0) purchase.status = 'sold_out';
    else purchase.status = 'partially_sold';

    await purchase.save();
    return { ok: true };
  }

  const materialName = sale.materialName;
  if (!materialName || !String(materialName).trim()) {
    return { ok: true };
  }

  return fifoReturnProduction(
    {
      materialName: sale.materialName,
      quality: sale.quality,
      materialColor: sale.materialColor,
    },
    weight
  );
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
      billNo: bodyBillNo,
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

    const finalInvoiceNo = await generateSaleInvoiceNo();
    const billNo = String(bodyBillNo || req.body.billNo || "").trim();

    try {
      await assertBillNoUnique(billNo);
    } catch (e) {
      if (e.code === 'DUPLICATE_BILL_NO') {
        return res.status(409).json({ success: false, message: e.message });
      }
      throw e;
    }

    const dup = await Sale.findOne({ invoiceNo: finalInvoiceNo });
    if (dup) {
      return res.status(409).json({
        success: false,
        message: `Duplicate invoice number: ${finalInvoiceNo}`,
      });
    }
    const parsedLineItems = parseLineItemsFromBody(req.body);
    const isMultiLineSale = parsedLineItems.length > 1;

    if (productionId && purchaseId) {
      return res.status(400).json({
        success: false,
        message: "Provide either purchaseId or productionId, not both"
      });
    }
    const fromAggregatedProduction =
      !isMultiLineSale &&
      !productionId &&
      !purchaseId &&
      bodyMaterialName &&
      bodyMaterialName.trim() !== "";
    if (!isMultiLineSale && !productionId && !purchaseId && !fromAggregatedProduction) {
      return res.status(400).json({
        success: false,
        message: "Required: purchaseId (POP), productionId (single batch), or materialName+quality+materialColor (aggregated Production)"
      });
    }

    const weightToSell = isMultiLineSale
      ? parsedLineItems.reduce((sum, li) => sum + li.weight, 0)
      : parseFloat(sellingWeight);
    if (isNaN(weightToSell) || weightToSell <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid selling weight is required"
      });
    }

    const receiptImage = req.file ? `/uploads/receipts/${req.file.filename}` : "";
    const saleDateParts = splitSaleDateTime(saleDate);
    const cashFromBody = parseFloat(amountPaid) || 0;
    const discountNum = parseFloat(req.body.discount) || 0;
    const sellingPriceNum = computeSaleBillTotal({
      ...req.body,
      sellingWeight: weightToSell,
    });

    const payMethodEarly = String(paymentMethod || "cash").toLowerCase();
    const hasAdvanceField =
      req.body.advancePayment !== undefined && req.body.advancePayment !== "";
    let advanceApplied = 0;
    let cashPaid = cashFromBody;

    if (req.body.customerId) {
      const custForAdv = await Customer.findById(req.body.customerId);
      if (custForAdv && (custForAdv.financeAdvanceBalance || 0) > 0) {
        if (hasAdvanceField) {
          advanceApplied = resolveAdvanceForSale(
            custForAdv,
            sellingPriceNum,
            parseFloat(req.body.advancePayment)
          );
        } else {
          advanceApplied = resolveAdvanceForSale(custForAdv, sellingPriceNum, -1);
        }
        if (payMethodEarly === "advance" && advanceApplied === 0 && cashPaid > 0) {
          advanceApplied = resolveAdvanceForSale(custForAdv, sellingPriceNum, cashPaid);
          cashPaid = 0;
        }
      }
    }

    if (advanceApplied + cashPaid > sellingPriceNum) {
      cashPaid = Math.max(0, sellingPriceNum - advanceApplied);
    }
    const paidAmount = Math.min(sellingPriceNum, advanceApplied + cashPaid);
    const remainingAmount = Math.max(0, sellingPriceNum - paidAmount);
    const billTotalStr = String(sellingPriceNum);
    const transportNum = parseFloat(transportationCost) || 0;
    const pricePerKgBody = parseFloat(req.body.pricePerKg);
    const sellingPricePerKg = isMultiLineSale
      ? 0
      : !isNaN(pricePerKgBody) && pricePerKgBody > 0
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

    if (isMultiLineSale) {
      for (const li of parsedLineItems) {
        if (li.sellingPricePerKg <= 0) {
          return res.status(400).json({
            success: false,
            message: `Valid selling rate required for ${li.materialName}`,
          });
        }
        const stockResult = await fifoDeductProduction(
          {
            materialName: li.materialName,
            quality: li.quality,
            materialColor: li.materialColor,
          },
          li.weight
        );
        if (!stockResult.ok) {
          return res.status(400).json({
            success: false,
            message: `${li.materialName}: ${stockResult.message}`,
          });
        }
      }

      const uniqueMaterials = [...new Set(parsedLineItems.map((li) => li.materialName))];
      const enrichedLineItems = await enrichLineItemsWithCost(parsedLineItems);
      materialName = uniqueMaterials.join(" + ");
      supplierName = bodySupplierName || "Production";
      materialColor = enrichedLineItems[0]?.materialColor || "#FFFFFF";
      actualPrice = bodyActualPrice || "0";

      salePayload = {
        productionId: enrichedLineItems[0]?.productionId || undefined,
        purchaseId: undefined,
        materialName,
        supplierName,
        quality: enrichedLineItems[0]?.quality || "Standard",
        invoiceNo: finalInvoiceNo,
        weight: String(weightToSell),
        unit:
          requestUnit !== undefined && requestUnit !== null && String(requestUnit).trim() !== ""
            ? String(requestUnit).trim()
            : "0",
        purchaseDate: saleDateParts.purchaseDate,
        purchaseTime: saleDateParts.purchaseTime,
        branch: "Main",
        materialColor,
        actualPrice,
        productionCost: "0",
        costPerKg: 0,
        actualCostPerKg: 0,
        sellingPrice: billTotalStr,
        sellingPricePerKg: 0,
        discount: String(discountNum),
        finalAmount: billTotalStr,
        advancePayment: advanceApplied,
        amountPaid: paidAmount,
        remainingAmount: remainingAmount,
        paymentStatus: finalPaymentStatus,
        buyerName: customerName,
        buyerAddress: req.body.buyerAddress || "",
        buyerPhone: customerPhone || "",
        buyerEmail: customerEmail || "",
        buyerCnic: req.body.buyerCnic || "",
        buyerCompany: req.body.buyerCompany || "",
        receiptImage,
        transportationCost: transportationCost || 0,
        notes: notes || "",
        lineItems: enrichedLineItems,
      };
    } else if (productionId) {
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
        purchaseDate: saleDateParts.purchaseDate,
        purchaseTime: saleDateParts.purchaseTime,
        branch: "Main",
        materialColor,
        actualPrice,
        productionCost: String(production.totalProductionCost || production.materialCost || 0),
        costPerKg: weightToSell > 0 ? (production.totalProductionCost || 0) / weightToSell : 0,
        sellingPrice: billTotalStr,
        sellingPricePerKg,
        discount: String(discountNum),
        finalAmount: billTotalStr,
        advancePayment: advanceApplied,
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
        purchaseDate: saleDateParts.purchaseDate,
        purchaseTime: saleDateParts.purchaseTime,
        branch: "Main",
        materialColor,
        actualPrice,
        productionCost: "0",
        sellingPrice: billTotalStr,
        sellingPricePerKg,
        discount: String(discountNum),
        finalAmount: billTotalStr,
        advancePayment: advanceApplied,
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
        purchaseDate: saleDateParts.purchaseDate,
        purchaseTime: saleDateParts.purchaseTime,
        branch: "Main",
        materialColor,
        actualPrice,
        productionCost: "0",
        sellingPrice: billTotalStr,
        sellingPricePerKg,
        discount: String(discountNum),
        finalAmount: billTotalStr,
        advancePayment: advanceApplied,
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
    salePayload.billNo = billNo;
    salePayload.paymentMethod = paymentMethod || 'cash';
    salePayload.customerId = req.body.customerId;
    salePayload.approvalStatus = 'pending';
    salePayload.createdBy = req.user?.username || req.body.createdBy || 'system';
    // Transportation cost should be recorded as an Expense, not saved against the Sale invoice.
    // Keep transport amount in `transportNum` then zero it on the sale payload so invoices don't carry transport.
    salePayload.transportationCost = 0;
    salePayload.notes = notes || '';

    const matForCost = salePayload.materialName || bodyMaterialName;
    const qualForCost = salePayload.quality || bodyQuality;
    const colorForCost = salePayload.materialColor || bodyMaterialColor;
    if (matForCost && !isMultiLineSale) {
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
    if (advanceApplied > 0 && req.body.customerId) {
      const adv = await applyCustomerFinanceAdvance(
        req.body.customerId,
        advanceApplied,
        finalInvoiceNo
      );
      if (!adv.ok) {
        return res.status(400).json({ success: false, message: adv.message });
      }
    }
    if (cashPaid > 0) {
      const resolvedPaymentDate = resolvePosFinancePaymentDate({
        saleDate,
        purchaseDate: salePayload.purchaseDate,
      });
      const tx = await recordPosFinanceDeposit({
        amount: cashPaid,
        paymentMethod: payMethod,
        invoiceNo: finalInvoiceNo,
        customerName,
        customerId: req.body.customerId,
        transactionDate: resolvedPaymentDate,
      });
      salePayload.paymentLedger = [
        buildPaymentLedgerEntry({
          amount: cashPaid,
          paymentDate: resolvedPaymentDate,
          paymentMethod: payMethod,
          notes: 'Payment on sale',
          transactionId: tx?._id,
        }),
      ];
    }

    if (!salePayload.lineItems?.length) {
      const singleLineItems = parseLineItemsFromBody(req.body);
      if (singleLineItems.length > 0) {
        salePayload.lineItems = await enrichLineItemsWithCost(singleLineItems);
      }
    }

    const sale = await Sale.create(salePayload);

    // If there was a transportation cost provided, create an Expense record for it (non-blocking).
    if (transportNum && transportNum > 0) {
      try {
        const expDate = salePayload.purchaseDate || new Date().toISOString().split('T')[0];
        const expTime = salePayload.purchaseTime || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        await Expense.create({
          subject: `Transport - Invoice ${finalInvoiceNo}`,
          description: `Transportation cost for invoice ${finalInvoiceNo}`,
          purpose: 'Travel',
          paymentMethod: String(paymentMethod || 'drawer'),
          category: 'Transport',
          price: String(transportNum),
          personResponsible: 'Admin',
          usage: 'Company',
          date: expDate,
          time: expTime,
        });
      } catch (expErr) {
        console.warn('Failed to create transport expense for sale', finalInvoiceNo, expErr.message || expErr);
      }
    }

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
    delete updateData.invoiceNo;
    if (updateData.billNo !== undefined) {
      updateData.billNo = String(updateData.billNo || "").trim();
      try {
        await assertBillNoUnique(updateData.billNo, { excludeSaleId: id });
      } catch (e) {
        if (e.code === 'DUPLICATE_BILL_NO') {
          return res.status(409).json({ success: false, message: e.message });
        }
        throw e;
      }
    }

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

    const delta = newPaid > oldPaid ? round2(newPaid - oldPaid) : 0;
    let paymentLedgerEntry = null;

    if (delta > 0) {
      const payMethod = String(
        updateData.paymentMethod || existingSale.paymentMethod || 'cash'
      ).toLowerCase();
      const resolvedPaymentDate = resolvePosFinancePaymentDate({
        paymentDate: req.body.paymentDate || req.body.payment_date,
        purchaseDate: existingSale.purchaseDate,
      });
      let tx = null;
      if (payMethod !== 'advance') {
        tx = await recordPosFinanceDeposit({
          amount: delta,
          paymentMethod: payMethod,
          invoiceNo: existingSale.invoiceNo || id,
          customerName: existingSale.buyerName || 'Customer',
          customerId: existingSale.customerId,
          transactionDate: resolvedPaymentDate,
        });
      }
      paymentLedgerEntry = buildPaymentLedgerEntry({
        amount: delta,
        paymentDate: resolvedPaymentDate,
        paymentMethod: payMethod,
        notes: req.body.paymentNotes || req.body.notes || `Payment Rs. ${delta.toLocaleString('en-PK')}`,
        clientPaymentId: req.body.clientPaymentId || req.body.paymentId || '',
        transactionId: tx?._id,
      });
    }

    const updateOps = { ...updateData };
    delete updateOps.paymentDate;
    delete updateOps.payment_date;
    delete updateOps.paymentNotes;
    delete updateOps.clientPaymentId;
    delete updateOps.paymentId;

    let sale;
    if (paymentLedgerEntry) {
      const dupFilter = paymentLedgerEntry.clientPaymentId
        ? { _id: id, 'paymentLedger.clientPaymentId': { $ne: paymentLedgerEntry.clientPaymentId } }
        : { _id: id };
      sale = await Sale.findOneAndUpdate(
        dupFilter,
        { $set: updateOps, $push: { paymentLedger: paymentLedgerEntry } },
        { new: true }
      );
      if (!sale) {
        sale = await Sale.findByIdAndUpdate(id, updateOps, { new: true });
      }
    } else {
      sale = await Sale.findByIdAndUpdate(id, updateOps, { new: true });
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

    const stockResult = await restoreSaleStock(sale);
    if (!stockResult.ok) {
      return res.status(400).json({
        success: false,
        message: stockResult.message || "Stock reverse nahi ho saka — sale delete cancel",
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
      message: "Sale delete ho gayi aur stock wapas add ho gaya",
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

/** Migrate browser localStorage payment records into sale.paymentLedger */
async function rebuildPaymentLedgerFromFinance() {
  const sales = await Sale.find({
    amountPaid: { $gt: 0 },
    $or: [{ paymentLedger: { $exists: false } }, { paymentLedger: { $size: 0 } }],
  });

  let rebuilt = 0;
  for (const sale of sales) {
    const invoiceNo = sale.invoiceNo;
    if (!invoiceNo) continue;

    const txs = await Transaction.find({
      category: 'pos_payment',
      type: 'deposit',
      reference: invoiceNo,
    })
      .sort({ createdAt: 1 })
      .lean();

    if (!txs.length) continue;

    sale.paymentLedger = sale.paymentLedger || [];
    for (const tx of txs) {
      const clientId = String(tx._id);
      if (sale.paymentLedger.some((e) => e.clientPaymentId === clientId)) continue;
      sale.paymentLedger.push(
        buildPaymentLedgerEntry({
          amount: tx.amount,
          paymentDate: tx.createdAt,
          paymentMethod: tx.method,
          notes: tx.description || '',
          clientPaymentId: clientId,
          transactionId: tx._id,
        })
      );
    }
    if (sale.paymentLedger.length > 0) {
      await sale.save();
      rebuilt++;
    }
  }
  return rebuilt;
}

const syncSalePayments = async (req, res) => {
  try {
    const payments = Array.isArray(req.body.payments) ? req.body.payments : [];
    let synced = 0;
    let skipped = 0;

    for (const p of payments) {
      const saleId = p.saleId;
      if (!saleId || !mongoose.Types.ObjectId.isValid(saleId)) {
        skipped++;
        continue;
      }
      const sale = await Sale.findById(saleId);
      if (!sale) {
        skipped++;
        continue;
      }

      const clientId = p._id || p.clientPaymentId || '';
      if (
        clientId &&
        (sale.paymentLedger || []).some((e) => e.clientPaymentId === clientId)
      ) {
        skipped++;
        continue;
      }

      const amt = parseFloat(p.amount);
      if (!amt || amt <= 0) {
        skipped++;
        continue;
      }

      sale.paymentLedger = sale.paymentLedger || [];
      sale.paymentLedger.push(
        buildPaymentLedgerEntry({
          amount: amt,
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
          notes: p.notes || '',
          clientPaymentId: clientId,
        })
      );
      await sale.save();
      synced++;
    }

    const rebuilt = await rebuildPaymentLedgerFromFinance();

    res.json({
      success: true,
      message: `${synced} payment record(s) ledger mein sync ho gaye`,
      synced,
      skipped,
      rebuilt,
    });
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
  syncSalePayments,
};