const Transaction = require('../models/transaction.model');

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(v) {
  return Math.round(num(v) * 100) / 100;
}

function normalizePopPaymentMethod(method) {
  const raw = String(method || 'drawer').toLowerCase();
  if (raw === 'cash') return 'drawer';
  if (['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(raw)) return raw;
  return 'drawer';
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

function isPopPaymentTransaction(tx) {
  if (!tx) return false;
  return (
    tx.type === 'withdraw' &&
    String(tx.description || '').trim().toLowerCase().startsWith('pop payment')
  );
}

async function findPopPaymentTransactions(invoiceNo) {
  if (!invoiceNo) return [];
  const ref = String(invoiceNo).trim();
  const txs = await Transaction.find({
    reference: ref,
    type: 'withdraw',
  })
    .sort({ createdAt: 1 })
    .lean();

  const popTxs = txs.filter(isPopPaymentTransaction);
  return popTxs.length > 0 ? popTxs : txs;
}

/**
 * Keep Finance in sync when POP amountPaid changes on edit.
 * Deletes old POP withdraw entries and recreates one for the new amount (if any).
 */
async function syncPopFinancePaymentOnUpdate({
  invoiceNo,
  vendor,
  purchaseDate,
  newAmountPaid,
  paymentMethod,
}) {
  const targetPaid = round2(newAmountPaid);
  const existingTxs = await findPopPaymentTransactions(invoiceNo);
  const existingTotal = round2(existingTxs.reduce((sum, tx) => sum + num(tx.amount), 0));

  if (Math.abs(existingTotal - targetPaid) < 0.01) {
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

  const method = normalizePopPaymentMethod(paymentMethod);
  const balances = await Transaction.getBalances();
  if ((balances[method] || 0) < targetPaid) {
    return {
      ok: false,
      message: `Insufficient balance in ${method}. Available: Rs. ${(balances[method] || 0).toLocaleString('en-PK')}`,
    };
  }

  await Transaction.create({
    type: 'withdraw',
    method,
    amount: targetPaid,
    net: targetPaid,
    description: `POP payment ${invoiceNo} - ${vendor || 'Vendor'}`,
    reference: invoiceNo,
    status: 'completed',
    date: parsePopPaymentDate(purchaseDate),
  });

  return {
    ok: true,
    synced: true,
    action: existingTxs.length > 0 ? 'updated' : 'created',
    amount: targetPaid,
  };
}

module.exports = {
  findPopPaymentTransactions,
  syncPopFinancePaymentOnUpdate,
  isPopPaymentTransaction,
};
