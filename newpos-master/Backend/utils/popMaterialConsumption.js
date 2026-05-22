/**
 * POP: sirf jis product code ki production ho usi line se weight minus.
 * MongoDB positional $ — materials.productCode match → sirf wahi line update.
 */

const Purchase = require("../models/pop.model.js");

const VALID_CODES = ["100", "105", "110"];

function normCode(code) {
  return String(code || "").trim();
}

function isValidCode(code) {
  return VALID_CODES.includes(normCode(code));
}

function getLineWeight(material) {
  return parseFloat(material?.weight) || 0;
}

function getLineConsumedOnMaterial(material) {
  return parseFloat(material?.productionConsumedWeight) || 0;
}

/** Sirf is material line ka consumed (index + code) — shared codeConsumption map se nahi */
function getLineAvailableKg(material, productCode) {
  const matWeight = getLineWeight(material);
  const consumed = getLineConsumedOnMaterial(material);
  return Math.max(0, matWeight - consumed);
}

function findLineIndexByCodeOnly(purchase, productCode) {
  const code = normCode(productCode);
  if (!code) return -1;
  const mats = purchase.materials || [];
  return mats.findIndex((m) => normCode(m.productCode) === code);
}

/** Totals after line-level deduct */
async function recalcPurchaseTotals(purchaseId) {
  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) return;

  const mats = purchase.materials || [];
  if (!mats.length) return;

  const cc = {};
  let totalConsumed = 0;
  let remainingSum = 0;

  for (const m of mats) {
    const code = normCode(m.productCode);
    const lineC = getLineConsumedOnMaterial(m);
    if (code) cc[code] = lineC;
    totalConsumed += lineC;
    remainingSum += Math.max(0, getLineWeight(m) - lineC);
  }

  await Purchase.updateOne(
    { _id: purchaseId },
    {
      $set: {
        codeConsumption: cc,
        productionConsumedWeight: totalConsumed,
        remainingWeight: Math.max(0, remainingSum),
      },
    }
  );
}

function getAvailableKgForLine(purchase, productCode) {
  const code = normCode(productCode);
  if (!isValidCode(code)) return 0;

  const mats = purchase.materials || [];
  if (mats.length > 0) {
    const idx = findLineIndexByCodeOnly(purchase, code);
    if (idx < 0) return 0;
    return getLineAvailableKg(mats[idx], code);
  }

  const originalWeight = parseFloat(purchase.weight) || 0;
  const sold = parseFloat(purchase.soldWeight) || 0;
  const consumed = parseFloat(purchase.productionConsumedWeight) || 0;
  return Math.max(0, originalWeight - sold - consumed);
}

/**
 * Deduct weight — ONLY the materials[] row whose productCode matches (positional $)
 */
async function deductPopWeight(purchaseId, { productCode, weight }) {
  const amt = parseFloat(weight) || 0;
  const code = normCode(productCode);
  if (amt <= 0) return { ok: true, deducted: 0 };
  if (!isValidCode(code)) {
    return { ok: false, message: "Product code 100, 105 ya 110 hona chahiye" };
  }

  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) return { ok: false, message: "POP not found" };

  const mats = purchase.materials || [];

  if (mats.length > 0) {
    const idx = findLineIndexByCodeOnly(purchase, code);
    if (idx < 0) {
      return {
        ok: false,
        message: `POP bill par Code ${code} ki alag line nahi — POP edit karke har material par sahi code lagayen`,
      };
    }

    const line = mats[idx];
    const available = getLineAvailableKg(line, code);
    if (amt > available + 0.01) {
      return {
        ok: false,
        message: `Code ${code}: sirf ${available} kg bacha hai`,
      };
    }

    const lineUpdate = await Purchase.updateOne(
      { _id: purchaseId, "materials.productCode": code },
      { $inc: { "materials.$.productionConsumedWeight": amt } }
    );

    if (!lineUpdate.matchedCount || !lineUpdate.modifiedCount) {
      return {
        ok: false,
        message: `Code ${code} ki line update nahi hui — productCode DB mein check karen`,
      };
    }

    const ccKey = `codeConsumption.${code}`;
    await Purchase.updateOne({ _id: purchaseId }, { $inc: { [ccKey]: amt } });

    await recalcPurchaseTotals(purchaseId);

    return { ok: true, deducted: amt, productCode: code, lineIndex: idx };
  }

  const available = getAvailableKgForLine(purchase, code);
  if (amt > available + 0.01) {
    return { ok: false, message: `POP par sirf ${available} kg bacha hai` };
  }
  await Purchase.updateOne(
    { _id: purchaseId },
    {
      $inc: {
        productionConsumedWeight: amt,
        [`codeConsumption.${code}`]: amt,
      },
    }
  );
  return { ok: true, deducted: amt, productCode: code };
}

async function restorePopWeight(purchaseId, { productCode, weight }) {
  const amt = parseFloat(weight) || 0;
  const code = normCode(productCode);
  if (amt <= 0 || !isValidCode(code)) return { ok: true };

  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) return { ok: false, message: "POP not found" };

  const mats = purchase.materials || [];
  if (mats.length > 0) {
    const idx = findLineIndexByCodeOnly(purchase, code);
    if (idx < 0) return { ok: false, message: "Line not found" };

    const line = mats[idx];
    const current = getLineConsumedOnMaterial(line);
    const restore = Math.min(amt, current);
    if (restore <= 0) return { ok: true };

    await Purchase.updateOne(
      { _id: purchaseId, "materials.productCode": code },
      { $inc: { "materials.$.productionConsumedWeight": -restore } }
    );
    const ccKey = `codeConsumption.${code}`;
    await Purchase.updateOne({ _id: purchaseId }, { $inc: { [ccKey]: -restore } });
    await recalcPurchaseTotals(purchaseId);
    return { ok: true };
  }

  const current = parseFloat(purchase.productionConsumedWeight) || 0;
  await Purchase.updateOne(
    { _id: purchaseId },
    {
      $set: {
        productionConsumedWeight: Math.max(0, current - amt),
      },
      $inc: { [`codeConsumption.${code}`]: -amt },
    }
  );
  return { ok: true };
}

function getPopLinePricing(purchase, productCode) {
  const code = normCode(productCode);
  const mats = purchase.materials || [];
  if (mats.length > 0 && code) {
    const idx = findLineIndexByCodeOnly(purchase, code);
    if (idx >= 0) {
      const line = mats[idx];
      const w = getLineWeight(line);
      const pricePerKg = parseFloat(line.pricePerKg) || 0;
      const totalAmount = parseFloat(line.totalAmount) || 0;
      return {
        purchasePrice: totalAmount > 0 ? totalAmount : pricePerKg * w,
        purchaseWeight: w,
      };
    }
  }
  return {
    purchasePrice: parseFloat(purchase.price) || 0,
    purchaseWeight: parseFloat(purchase.weight) || 0,
  };
}

function getPurchaseDisplayWeights(purchase) {
  const mats = purchase.materials || [];
  if (!mats.length) {
    const totalWeight = parseFloat(purchase.weight) || 0;
    const sold = parseFloat(purchase.soldWeight) || 0;
    const productionConsumed = parseFloat(purchase.productionConsumedWeight) || 0;
    return {
      productionConsumedWeight: productionConsumed,
      remainingWeight: Math.max(0, totalWeight - sold - productionConsumed),
    };
  }
  let productionConsumedWeight = 0;
  let remainingWeight = 0;
  for (const m of mats) {
    const c = getLineConsumedOnMaterial(m);
    productionConsumedWeight += c;
    remainingWeight += getLineAvailableKg(m, m.productCode);
  }
  return { productionConsumedWeight, remainingWeight };
}

/** Build processing queue rows — har line ka apna weight, doosre code se link nahi */
function buildProcessingQueueItems(purchases) {
  const items = [];
  const VALID = new Set(VALID_CODES);

  for (const purchase of purchases) {
    const base = {
      purchaseId: String(purchase._id),
      receiptNo: purchase.receiptNo || purchase.invoiceNo || "N/A",
      quality: purchase.quality || "Unknown",
      color: purchase.materialColor || "#FFFFFF",
      vendor: purchase.vendor || "Unknown",
      purchaseDate: purchase.purchaseDate || purchase.createdAt,
      purchasePrice: parseFloat(purchase.price) || 0,
      status: "pending",
    };

    const mats = purchase.materials || [];

    if (mats.length > 0) {
      mats.forEach((m, idx) => {
        const code = normCode(m.productCode);
        if (!VALID.has(code)) return;

        const matWeight = getLineWeight(m);
        const lineConsumed = getLineConsumedOnMaterial(m);
        const available = Math.max(0, matWeight - lineConsumed);
        if (available <= 0) return;

        const pricePerKg = parseFloat(m.pricePerKg) || 0;
        const totalAmount = parseFloat(m.totalAmount) || 0;
        const linePrice = totalAmount > 0 ? totalAmount : pricePerKg * matWeight;

        items.push({
          _id: `${purchase._id}-${code}-${idx}`,
          ...base,
          materialName: (m.name || "").trim() || purchase.materialName || "Unknown",
          productCode: code,
          materialLineIndex: idx,
          originalWeight: matWeight,
          availableWeight: Math.round(available * 10) / 10,
          purchasePrice: linePrice > 0 ? linePrice : base.purchasePrice,
        });
      });
    } else {
      const originalWeight = parseFloat(purchase.weight) || 0;
      const consumed = parseFloat(purchase.productionConsumedWeight) || 0;
      const available = originalWeight - consumed;
      if (available <= 0) return;

      const cc = purchase.codeConsumption || {};
      let code = null;
      for (const c of VALID_CODES) {
        if (cc[c] != null || consumed > 0) {
          code = c;
          break;
        }
      }

      items.push({
        _id: String(purchase._id),
        ...base,
        materialName: purchase.materialName || "Unknown",
        productCode: code || "100",
        materialLineIndex: 0,
        originalWeight,
        availableWeight: Math.round(available * 10) / 10,
      });
    }
  }

  return items;
}

module.exports = {
  VALID_CODES,
  isValidCode,
  getAvailableKgForLine,
  deductPopWeight,
  restorePopWeight,
  getPopLinePricing,
  getPurchaseDisplayWeights,
  buildProcessingQueueItems,
  findLineIndexByCodeOnly,
};
