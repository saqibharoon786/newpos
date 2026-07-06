const Transaction = require('../models/transaction.model');
const { isPosPaymentTransaction } = require('./posPaymentDelete');

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(v) {
  return Math.round(num(v) * 100) / 100;
}

function normalizePosPaymentMethod(method) {
  const raw = String(method || 'cash').toLowerCase();
  if (raw === 'cash') return 'drawer';
  if (['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(raw)) return raw;
  return 'drawer';
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

async function findPosPaymentTransactions(invoiceNo) {
  if (!invoiceNo) return [];
  const ref = String(invoiceNo).trim();
  const txs = await Transaction.find({
    reference: ref,
    type: 'deposit',
    status: 'completed',
  })
    .sort({ createdAt: 1 })
    .lean();

  return txs.filter(isPosPaymentTransaction);
}

function buildSyncedLedgerEntry({
  amount,
  paymentDate,
  paymentMethod,
  notes,
  transactionId,
}) {
  const d = paymentDate ? new Date(paymentDate) : new Date();
  const method = normalizePosPaymentMethod(paymentMethod);
  return {
    date: Number.isNaN(d.getTime()) ? new Date() : d,
    amount: round2(amount),
    method,
    notes: notes || '',
    clientPaymentId: '',
    transactionId: transactionId || undefined,
  };
}

/**
 * Keep Finance in sync when POS amountPaid decreases on edit.
 * Deletes old POS deposit entries and recreates one for the new cash amount (if any).
 */
async function syncPosFinancePaymentOnUpdate({
  invoiceNo,
  customerName,
  customerId,
  newAmountPaid,
  advancePayment,
  paymentMethod,
  transactionDate,
  existingLedger = [],
}) {
  const advance = round2(advancePayment);
  const targetCash = round2(Math.max(0, num(newAmountPaid) - advance));
  const existingTxs = await findPosPaymentTransactions(invoiceNo);
  const existingTotal = round2(existingTxs.reduce((sum, tx) => sum + num(tx.amount), 0));

  if (Math.abs(existingTotal - targetCash) < 0.01) {
    return { ok: true, synced: false, paymentLedger: existingLedger };
  }

  for (const tx of existingTxs) {
    await Transaction.findByIdAndDelete(tx._id);
  }

  let paymentLedger = (existingLedger || []).filter((entry) => {
    const method = String(entry.method || '').toLowerCase();
    return method === 'advance';
  });

  if (targetCash <= 0) {
    return {
      ok: true,
      synced: true,
      action: 'removed',
      message: 'POS payment Finance se hata di gayi',
      removedCount: existingTxs.length,
      paymentLedger,
    };
  }

  const method = normalizePosPaymentMethod(paymentMethod);
  const date =
    transactionDate && !Number.isNaN(new Date(transactionDate).getTime())
      ? new Date(transactionDate)
      : new Date();

  const newTx = await Transaction.create({
    type: 'deposit',
    method,
    amount: targetCash,
    net: targetCash,
    description: `Payment received - POS ${invoiceNo} - ${customerName || 'Customer'}`,
    reference: invoiceNo,
    status: 'completed',
    date,
    partyType: customerId ? 'customer' : undefined,
    partyId: customerId || undefined,
    partyName: customerName || undefined,
    category: 'pos_payment',
  });

  paymentLedger.push(
    buildSyncedLedgerEntry({
      amount: targetCash,
      paymentDate: date,
      paymentMethod: method,
      notes: `Payment Rs. ${targetCash.toLocaleString('en-PK')}`,
      transactionId: newTx._id,
    })
  );

  return {
    ok: true,
    synced: true,
    action: existingTxs.length > 0 ? 'updated' : 'created',
    amount: targetCash,
    paymentLedger,
    message: 'POS payment Finance sync ho gayi',
  };
}

module.exports = {
  findPosPaymentTransactions,
  syncPosFinancePaymentOnUpdate,
  parsePosPaymentDate,
};
