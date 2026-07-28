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

/**
 * POP edit par nayi materials[] save karte waqt pehle process ho chuki lines ka
 * productionConsumedWeight preserve karo — warna saari lines dubara queue mein aa jati hain.
 */
function mergeMaterialsWithConsumption(existingMaterials, incomingMaterials, purchaseMeta = {}) {
  const existing = (existingMaterials || []).map((m) => ({
    productCode: normCode(m.productCode),
    name: String(m.name || m.materialName || "").trim(),
    weight: getLineWeight(m),
    consumed: getLineConsumedOnMaterial(m),
  }));
  const used = new Set();
  const legacyCc = purchaseMeta.codeConsumption || {};
  const legacyConsumed = parseFloat(purchaseMeta.productionConsumedWeight) || 0;
  const hadLegacyLines = existing.length === 0 && legacyConsumed > 0;

  return (incomingMaterials || []).map((incoming, idx) => {
    const code = normCode(incoming.productCode);
    const name = String(incoming.name || incoming.materialName || "").trim();
    const newWeight = parseFloat(incoming.weight) || 0;
    const pricePerKg = parseFloat(incoming.pricePerKg) || 0;
    const totalAmount =
      parseFloat(incoming.totalAmount) || (newWeight > 0 ? newWeight * pricePerKg : 0);

    let matchIdx = -1;

    matchIdx = existing.findIndex(
      (e, i) =>
        !used.has(i) &&
        e.productCode === code &&
        e.name.toLowerCase() === name.toLowerCase()
    );

    if (matchIdx < 0) {
      matchIdx = existing.findIndex(
        (e, i) =>
          !used.has(i) &&
          e.productCode === code &&
          Math.abs(e.weight - newWeight) < 0.01
      );
    }

    if (matchIdx < 0) {
      const sameCode = existing
        .map((e, i) => ({ e, i }))
        .filter(({ e, i }) => !used.has(i) && e.productCode === code);
      if (sameCode.length === 1) {
        matchIdx = sameCode[0].i;
      }
    }

    if (matchIdx < 0 && idx < existing.length && !used.has(idx) && existing[idx].productCode === code) {
      matchIdx = idx;
    }

    let preservedConsumed = 0;
    if (matchIdx >= 0) {
      used.add(matchIdx);
      preservedConsumed = existing[matchIdx].consumed;
    } else if (hadLegacyLines && code && legacyCc[code] != null) {
      preservedConsumed = parseFloat(legacyCc[code]) || 0;
    }

    return {
      name,
      weight: newWeight,
      pricePerKg,
      totalAmount,
      productCode: code,
      productionConsumedWeight: Math.min(Math.max(0, preservedConsumed), newWeight),
    };
  });
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

/** Exact POP line — materialLineIndex when provided, else first matching code */
function resolveMaterialLineIndex(purchase, productCode, materialLineIndex) {
  const mats = purchase.materials || [];
  if (!mats.length) return -1;
  const code = normCode(productCode);
  if (!code) return -1;
  const idx = parseInt(materialLineIndex, 10);
  if (!isNaN(idx) && idx >= 0 && idx < mats.length && normCode(mats[idx].productCode) === code) {
    return idx;
  }
  return findLineIndexByCodeOnly(purchase, code);
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
    if (code) cc[code] = (cc[code] || 0) + lineC;
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
async function deductPopWeight(purchaseId, { productCode, weight, materialLineIndex }) {
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
    const idx = resolveMaterialLineIndex(purchase, code, materialLineIndex);
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
        message: `Code ${code}: sirf ${available} kg bacha hai (is receipt ki line par)`,
      };
    }

    const lineUpdate = await Purchase.updateOne(
      { _id: purchaseId },
      { $inc: { [`materials.${idx}.productionConsumedWeight`]: amt } }
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

async function restorePopWeight(purchaseId, { productCode, weight, materialLineIndex }) {
  const amt = parseFloat(weight) || 0;
  const code = normCode(productCode);
  if (amt <= 0 || !isValidCode(code)) return { ok: true };

  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) return { ok: false, message: "POP not found" };

  const mats = purchase.materials || [];
  if (mats.length > 0) {
    const idx = resolveMaterialLineIndex(purchase, code, materialLineIndex);
    if (idx < 0) return { ok: false, message: "Line not found" };

    const line = mats[idx];
    const current = getLineConsumedOnMaterial(line);
    const restore = Math.min(amt, current);
    if (restore <= 0) return { ok: true };

    await Purchase.updateOne(
      { _id: purchaseId },
      { $inc: { [`materials.${idx}.productionConsumedWeight`]: -restore } }
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

function getPopLinePricing(purchase, productCode, materialLineIndex) {
  const code = normCode(productCode);
  const mats = purchase.materials || [];
  if (mats.length > 0 && code) {
    const idx = resolveMaterialLineIndex(purchase, code, materialLineIndex);
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

function parsePurchaseSortDate(purchase) {
  const d = purchase.purchaseDate || purchase.createdAt;
  if (!d) return 0;
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.getTime();
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [y, m, day] = d.split(/[-T]/).map(Number);
    return new Date(y, m - 1, day).getTime();
  }
  if (typeof d === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(d)) {
    const [dd, mm, yyyy] = d.split("/").map(Number);
    return new Date(yyyy, mm - 1, dd).getTime();
  }
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
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

        const linePricePerKg =
          matWeight > 0 && linePrice > 0
            ? Math.round((linePrice / matWeight) * 100) / 100
            : pricePerKg;

        items.push({
          _id: `${purchase._id}-${code}-${idx}`,
          ...base,
          materialName: (m.name || "").trim() || purchase.materialName || "Unknown",
          productCode: code,
          materialLineIndex: idx,
          originalWeight: matWeight,
          availableWeight: Math.round(available * 10) / 10,
          purchasePrice: linePrice > 0 ? linePrice : base.purchasePrice,
          pricePerKg: linePricePerKg,
        });
      });
    } else {
      const originalWeight = parseFloat(purchase.weight) || 0;
      const consumed = parseFloat(purchase.productionConsumedWeight) || 0;
      const available = originalWeight - consumed;
      if (available <= 0) continue;

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

/**
 * Queue for Process UI — overall by product code (100/105/110).
 * Total available kg across all POP invoices; production can FIFO-consume multiple receipts.
 */
function buildProcessingQueueByCode(purchases) {
  const lineItems = buildProcessingQueueItems(purchases);
  const byCode = new Map();

  for (const item of lineItems) {
    const code = normCode(item.productCode);
    if (!isValidCode(code)) continue;

    if (!byCode.has(code)) {
      byCode.set(code, {
        _id: `code-${code}`,
        productCode: code,
        materialNames: new Set(),
        qualities: new Set(),
        colors: new Set(),
        vendors: new Set(),
        availableWeight: 0,
        originalWeight: 0,
        purchaseValue: 0,
        valueWeight: 0,
        receiptCount: 0,
        oldestPurchaseDate: item.purchaseDate,
        oldestPurchaseId: item.purchaseId,
        oldestReceiptNo: item.receiptNo,
        lines: [],
        status: "pending",
      });
    }

    const g = byCode.get(code);
    g.materialNames.add(item.materialName || "Unknown");
    if (item.quality) g.qualities.add(item.quality);
    if (item.color) g.colors.add(item.color);
    if (item.vendor) g.vendors.add(item.vendor);
    g.availableWeight += item.availableWeight || 0;
    g.originalWeight += item.originalWeight || 0;
    g.receiptCount += 1;
    g.lines.push(item);

    const ppk = parseFloat(item.pricePerKg) || 0;
    const avail = parseFloat(item.availableWeight) || 0;
    if (ppk > 0 && avail > 0) {
      g.purchaseValue += ppk * avail;
      g.valueWeight += avail;
    }

    const itemTs = parsePurchaseSortDate({
      purchaseDate: item.purchaseDate,
      createdAt: item.purchaseDate,
    });
    const oldestTs = parsePurchaseSortDate({
      purchaseDate: g.oldestPurchaseDate,
      createdAt: g.oldestPurchaseDate,
    });
    if (itemTs > 0 && (oldestTs === 0 || itemTs < oldestTs)) {
      g.oldestPurchaseDate = item.purchaseDate;
      g.oldestPurchaseId = item.purchaseId;
      g.oldestReceiptNo = item.receiptNo;
    }
  }

  return Array.from(byCode.values())
    .map((g) => {
      const availableWeight = Math.round(g.availableWeight * 10) / 10;
      const pricePerKg =
        g.valueWeight > 0
          ? Math.round((g.purchaseValue / g.valueWeight) * 100) / 100
          : 0;
      const materialName = Array.from(g.materialNames).join(" · ") || "Unknown";
      const quality = Array.from(g.qualities)[0] || "Unknown";
      const color = Array.from(g.colors)[0] || "#FFFFFF";
      const vendorList = Array.from(g.vendors);
      return {
        _id: g._id,
        productCode: g.productCode,
        materialName,
        quality,
        color,
        vendor: vendorList.length === 1 ? vendorList[0] : "Multiple",
        purchaseDate: g.oldestPurchaseDate,
        purchaseId: g.oldestPurchaseId,
        receiptNo:
          g.receiptCount > 1 ? `${g.receiptCount} receipts` : g.oldestReceiptNo || "N/A",
        receiptCount: g.receiptCount,
        originalWeight: Math.round(g.originalWeight * 10) / 10,
        availableWeight,
        purchasePrice: Math.round(g.purchaseValue * 100) / 100,
        pricePerKg,
        status: "pending",
        consumeByCode: true,
        lines: g.lines,
      };
    })
    .filter((g) => g.availableWeight > 0)
    .sort((a, b) => String(a.productCode).localeCompare(String(b.productCode)));
}

/** All available POP lines for a product code, oldest purchase first (FIFO). */
function listAvailableLinesForCode(purchases, productCode) {
  const code = normCode(productCode);
  if (!isValidCode(code)) return [];

  const lines = [];
  const sorted = [...(purchases || [])].sort(
    (a, b) => parsePurchaseSortDate(a) - parsePurchaseSortDate(b)
  );

  for (const purchase of sorted) {
    const mats = purchase.materials || [];
    if (mats.length > 0) {
      mats.forEach((m, idx) => {
        if (normCode(m.productCode) !== code) return;
        const available = getLineAvailableKg(m, code);
        if (available <= 0) return;
        const pricing = getPopLinePricing(purchase, code, idx);
        const pricePerKg =
          pricing.purchaseWeight > 0 && pricing.purchasePrice > 0
            ? pricing.purchasePrice / pricing.purchaseWeight
            : parseFloat(m.pricePerKg) || 0;
        lines.push({
          purchaseId: String(purchase._id),
          materialLineIndex: idx,
          productCode: code,
          availableKg: available,
          receiptNo: purchase.receiptNo || purchase.invoiceNo || "N/A",
          materialName: (m.name || "").trim() || purchase.materialName || "Unknown",
          pricePerKg,
          purchasePrice: pricing.purchasePrice,
          purchaseWeight: pricing.purchaseWeight,
          purchaseDate: purchase.purchaseDate || purchase.createdAt,
        });
      });
    } else {
      const available = getAvailableKgForLine(purchase, code);
      if (available <= 0) continue;
      const purchasePrice = parseFloat(purchase.price) || 0;
      const purchaseWeight = parseFloat(purchase.weight) || 0;
      const pricePerKg =
        purchaseWeight > 0 && purchasePrice > 0 ? purchasePrice / purchaseWeight : 0;
      lines.push({
        purchaseId: String(purchase._id),
        materialLineIndex: 0,
        productCode: code,
        availableKg: available,
        receiptNo: purchase.receiptNo || purchase.invoiceNo || "N/A",
        materialName: purchase.materialName || "Unknown",
        pricePerKg,
        purchasePrice,
        purchaseWeight,
        purchaseDate: purchase.purchaseDate || purchase.createdAt,
      });
    }
  }

  return lines;
}

function getTotalAvailableKgForCode(purchases, productCode) {
  return listAvailableLinesForCode(purchases, productCode).reduce(
    (sum, line) => sum + (line.availableKg || 0),
    0
  );
}

/**
 * Deduct weight for a product code across multiple POP invoices (FIFO).
 * One production can use 2–3 receipts when needed.
 */
async function deductPopWeightFifo(productCode, weight) {
  const amt = parseFloat(weight) || 0;
  const code = normCode(productCode);
  if (amt <= 0) return { ok: true, deducted: 0, allocations: [] };
  if (!isValidCode(code)) {
    return { ok: false, message: "Product code 100, 105 ya 110 hona chahiye" };
  }

  const purchases = await Purchase.find().lean();
  const lines = listAvailableLinesForCode(purchases, code);
  const totalAvailable = lines.reduce((s, l) => s + l.availableKg, 0);

  if (amt > totalAvailable + 0.01) {
    return {
      ok: false,
      message: `Code ${code}: sirf ${Math.round(totalAvailable * 10) / 10} kg available (sab POP invoices milakar)`,
    };
  }

  let remaining = amt;
  const allocations = [];

  for (const line of lines) {
    if (remaining <= 0.001) break;
    const take = Math.min(remaining, line.availableKg);
    if (take <= 0) continue;

    const result = await deductPopWeight(line.purchaseId, {
      productCode: code,
      weight: take,
      materialLineIndex: line.materialLineIndex,
    });
    if (!result.ok) {
      // Best-effort rollback already deducted slices
      for (const done of allocations) {
        await restorePopWeight(done.purchaseId, {
          productCode: code,
          weight: done.weight,
          materialLineIndex: done.materialLineIndex,
        });
      }
      return result;
    }

    allocations.push({
      purchaseId: line.purchaseId,
      materialLineIndex: line.materialLineIndex,
      weight: Math.round(take * 1000) / 1000,
      receiptNo: line.receiptNo,
      pricePerKg: Math.round((line.pricePerKg || 0) * 100) / 100,
      materialName: line.materialName,
    });
    remaining -= take;
  }

  if (remaining > 0.01) {
    for (const done of allocations) {
      await restorePopWeight(done.purchaseId, {
        productCode: code,
        weight: done.weight,
        materialLineIndex: done.materialLineIndex,
      });
    }
    return {
      ok: false,
      message: `Code ${code}: stock deduct incomplete — ${Math.round(remaining * 10) / 10} kg short`,
    };
  }

  let totalCost = 0;
  let totalW = 0;
  for (const a of allocations) {
    totalCost += (a.weight || 0) * (a.pricePerKg || 0);
    totalW += a.weight || 0;
  }

  return {
    ok: true,
    deducted: amt,
    productCode: code,
    allocations,
    purchasePrice: Math.round(totalCost * 100) / 100,
    purchaseWeight: Math.round(totalW * 100) / 100,
    pricePerKg: totalW > 0 ? Math.round((totalCost / totalW) * 100) / 100 : 0,
    receiptNo:
      allocations.length > 1
        ? `${allocations.length} receipts`
        : allocations[0]?.receiptNo || "",
    primaryPurchaseId: allocations[0]?.purchaseId || null,
  };
}

async function restorePopWeightFromAllocations(allocations, productCode) {
  const code = normCode(productCode);
  const list = Array.isArray(allocations) ? allocations : [];
  if (!list.length || !isValidCode(code)) return { ok: true, restored: 0 };

  let restored = 0;
  for (const a of list) {
    const w = parseFloat(a.weight) || 0;
    if (w <= 0 || !a.purchaseId) continue;
    const result = await restorePopWeight(a.purchaseId, {
      productCode: code,
      weight: w,
      materialLineIndex: a.materialLineIndex,
    });
    if (result.ok) restored += w;
  }
  return { ok: true, restored };
}

module.exports = {
  VALID_CODES,
  isValidCode,
  getAvailableKgForLine,
  deductPopWeight,
  deductPopWeightFifo,
  restorePopWeight,
  restorePopWeightFromAllocations,
  getPopLinePricing,
  getPurchaseDisplayWeights,
  buildProcessingQueueItems,
  buildProcessingQueueByCode,
  listAvailableLinesForCode,
  getTotalAvailableKgForCode,
  findLineIndexByCodeOnly,
  resolveMaterialLineIndex,
  mergeMaterialsWithConsumption,
};
