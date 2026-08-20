const Transaction = require('../models/transaction.model');
const { normalizeFinancePaymentMethod } = require('./purchasePayment');

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(v) {
  return Math.round(num(v) * 100) / 100;
}

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePopPaymentDate(input) {
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

function collectPurchaseRefs({ invoiceNo, billNo, receiptNo }) {
  return [...new Set([invoiceNo, billNo, receiptNo]
    .filter(Boolean)
    .map((r) => String(r).trim())
    .filter(Boolean))];
}

function isPurchaseFinanceWithdraw(tx, refs) {
  if (!tx || tx.type !== 'withdraw') return false;

  const reference = String(tx.reference || '').trim();
  const desc = String(tx.description || '').trim().toLowerCase();

  if (refs.some((r) => reference === r)) return true;

  const purchaseDescPatterns = [
    /^pop payment\b/,
    /\bpayment for purchase\b/,
    /\bfull payment for purchase\b/,
    /\bpop payment -/,
  ];
  if (purchaseDescPatterns.some((re) => re.test(desc))) {
    return refs.length === 0 || refs.some((r) => desc.includes(r.toLowerCase()));
  }

  return refs.some((r) => desc.includes(r.toLowerCase()));
}

/**
 * Find every Finance withdraw linked to a POP bill (POP payment, legacy payment rows, orphans).
 */
async function findPurchaseFinanceTransactions({ invoiceNo, billNo, receiptNo } = {}) {
  const refs = collectPurchaseRefs({ invoiceNo, billNo, receiptNo });
  if (refs.length === 0) return [];

  const orConditions = [];
  for (const r of refs) {
    orConditions.push({ reference: r });
    orConditions.push({ description: { $regex: escapeRegex(r), $options: 'i' } });
  }
  orConditions.push({ description: { $regex: /^pop payment/i } });
  orConditions.push({ description: { $regex: /payment for purchase/i } });
  orConditions.push({ description: { $regex: /full payment for purchase/i } });

  const candidates = await Transaction.find({
    type: 'withdraw',
    $or: orConditions,
  })
    .sort({ createdAt: 1 })
    .lean();

  return candidates.filter((tx) => isPurchaseFinanceWithdraw(tx, refs));
}

/** @deprecated use findPurchaseFinanceTransactions */
async function findPopPaymentTransactions(invoiceNo) {
  return findPurchaseFinanceTransactions({ invoiceNo });
}

function needsFinanceResync(existingTxs, targetPaid, paymentMethod) {
  const method = normalizeFinancePaymentMethod(paymentMethod);
  const existingTotal = round2(existingTxs.reduce((sum, tx) => sum + num(tx.amount), 0));

  if (existingTxs.length === 0 && targetPaid <= 0) return false;
  if (existingTxs.length > 1) return true;
  if (Math.abs(existingTotal - targetPaid) >= 0.01) return true;
  if (targetPaid <= 0 && existingTxs.length > 0) return true;
  if (existingTxs.length === 1 && existingTxs[0].method !== method) return true;

  return false;
}

/**
 * Keep Finance in sync when POP amountPaid changes (create, edit, record payment, remove payment).
 */
async function syncPopFinancePaymentOnUpdate({
  invoiceNo,
  billNo,
  receiptNo,
  vendor,
  purchaseDate,
  newAmountPaid,
  paymentMethod,
}) {
  const targetPaid = round2(newAmountPaid);
  const existingTxs = await findPurchaseFinanceTransactions({ invoiceNo, billNo, receiptNo });

  if (!needsFinanceResync(existingTxs, targetPaid, paymentMethod)) {
    return { ok: true, synced: false };
  }

  for (const tx of existingTxs) {
    await Transaction.findByIdAndDelete(tx._id);
  }

  if (targetPaid <= 0) {
    return {
      ok: true,
      synced: true,
      action: 'removed',
      message: 'POP payment Finance se hata di gayi',
      removedCount: existingTxs.length,
    };
  }

  const method = normalizeFinancePaymentMethod(paymentMethod);
  const balances = await Transaction.getBalances();
  if ((balances[method] || 0) < targetPaid) {
    return {
      ok: false,
      message: `Insufficient balance in ${method}. Available: Rs. ${(balances[method] || 0).toLocaleString('en-PK')}`,
    };
  }

  const ref = String(invoiceNo || billNo || receiptNo || '').trim() || `POP-${Date.now()}`;

  await Transaction.create({
    type: 'withdraw',
    method,
    amount: targetPaid,
    net: targetPaid,
    description: `POP payment ${ref} - ${vendor || 'Vendor'}`,
    reference: ref,
    status: 'completed',
    date: parsePopPaymentDate(purchaseDate),
  });

  return {
    ok: true,
    synced: true,
    action: existingTxs.length > 0 ? 'updated' : 'created',
    amount: targetPaid,
    removedCount: existingTxs.length,
  };
}

function isPopPaymentTransaction(tx) {
  return isPurchaseFinanceWithdraw(tx, []);
}

module.exports = {
  findPopPaymentTransactions,
  findPurchaseFinanceTransactions,
  syncPopFinancePaymentOnUpdate,
  isPopPaymentTransaction,
};
