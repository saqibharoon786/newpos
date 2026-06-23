const Purchase = require('../models/pop.model');
const Sale = require('../models/pos.model');

function normalizeBillNo(raw) {
  return String(raw || '').trim();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function exactBillNoRegex(normalized) {
  return new RegExp(`^${escapeRegex(normalized)}$`, 'i');
}

/**
 * Bill number POP + POS dono mein unique hona chahiye (manual bill/challan no).
 */
async function findBillNoConflict(billNo, { excludePurchaseId, excludeSaleId } = {}) {
  const normalized = normalizeBillNo(billNo);
  if (!normalized) return null;

  const pattern = exactBillNoRegex(normalized);

  const purchaseFilter = {
    $or: [{ billNo: pattern }, { receiptNo: pattern }],
  };
  if (excludePurchaseId) {
    purchaseFilter._id = { $ne: excludePurchaseId };
  }

  const popHit = await Purchase.findOne(purchaseFilter)
    .select('billNo receiptNo invoiceNo')
    .lean();
  if (popHit) {
    return {
      module: 'POP',
      reference: popHit.invoiceNo || popHit.billNo || popHit.receiptNo,
      message: `Bill number "${normalized}" pehle se POP (Purchase) mein use ho chuka hai${popHit.invoiceNo ? ` (${popHit.invoiceNo})` : ''}. Duplicate allowed nahi.`,
    };
  }

  const saleFilter = { billNo: pattern };
  if (excludeSaleId) {
    saleFilter._id = { $ne: excludeSaleId };
  }

  const saleHit = await Sale.findOne(saleFilter).select('billNo invoiceNo').lean();
  if (saleHit) {
    return {
      module: 'POS',
      reference: saleHit.invoiceNo || saleHit.billNo,
      message: `Bill number "${normalized}" pehle se POS (Sale) mein use ho chuka hai${saleHit.invoiceNo ? ` (${saleHit.invoiceNo})` : ''}. Duplicate allowed nahi.`,
    };
  }

  return null;
}

async function assertBillNoUnique(billNo, opts = {}) {
  const normalized = normalizeBillNo(billNo);
  if (!normalized) return '';

  const conflict = await findBillNoConflict(normalized, opts);
  if (conflict) {
    const err = new Error(conflict.message);
    err.code = 'DUPLICATE_BILL_NO';
    err.conflict = conflict;
    throw err;
  }
  return normalized;
}

module.exports = {
  normalizeBillNo,
  findBillNoConflict,
  assertBillNoUnique,
};
