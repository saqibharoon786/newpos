const Transaction = require('../models/transaction.model');
const Sale = require('../models/pos.model');

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(v) {
  return Math.round(num(v) * 100) / 100;
}

function isPosPaymentTransaction(transaction) {
  if (!transaction) return false;
  if (transaction.category === 'pos_payment') return true;
  return String(transaction.description || '').includes('Payment received - POS');
}

function findLedgerEntryForTransaction(sale, transaction) {
  const ledger = sale.paymentLedger || [];
  const tid = String(transaction._id);

  let entry = ledger.find(
    (e) =>
      (e.transactionId && String(e.transactionId) === tid) ||
      (e.clientPaymentId && String(e.clientPaymentId) === tid)
  );
  if (entry) return entry;

  const txAmt = num(transaction.amount);
  if (txAmt <= 0) return null;

  const byAmount = ledger.filter(
    (e) => Math.abs(num(e.amount) - txAmt) < 0.01 && !e.transactionId
  );
  if (byAmount.length === 1) return byAmount[0];

  return null;
}

async function findSaleForPosPaymentTransaction(transaction) {
  const saleByLedger = await Sale.findOne({
    'paymentLedger.transactionId': transaction._id,
  });
  if (saleByLedger) {
    return {
      sale: saleByLedger,
      entry: findLedgerEntryForTransaction(saleByLedger, transaction),
    };
  }

  const ref = String(transaction.reference || '').trim();
  if (!ref) return null;

  const saleByInvoice = await Sale.findOne({ invoiceNo: ref });
  if (!saleByInvoice) return null;

  return {
    sale: saleByInvoice,
    entry: findLedgerEntryForTransaction(saleByInvoice, transaction),
  };
}

function removeLedgerEntry(sale, transaction, entry) {
  const tid = String(transaction._id);
  sale.paymentLedger = (sale.paymentLedger || []).filter((e) => {
    if (entry?._id && e._id && String(e._id) === String(entry._id)) return false;
    if (e.transactionId && String(e.transactionId) === tid) return false;
    if (e.clientPaymentId && String(e.clientPaymentId) === tid) return false;
    return true;
  });
}

/**
 * Delete a POS payment Finance transaction and reverse the linked sale payment.
 */
async function reversePosPaymentTransaction(transactionId) {
  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    return { ok: false, status: 404, message: 'Transaction not found' };
  }

  if (!isPosPaymentTransaction(transaction)) {
    return {
      ok: false,
      status: 400,
      message: 'Ye POS payment transaction nahi hai',
    };
  }

  const payAmt = num(transaction.amount);
  if (payAmt <= 0) {
    return { ok: false, status: 400, message: 'Invalid transaction amount' };
  }

  const linked = await findSaleForPosPaymentTransaction(transaction);
  if (linked?.sale) {
    const { sale, entry } = linked;
    const reverseAmt = entry ? num(entry.amount) : payAmt;

    removeLedgerEntry(sale, transaction, entry);
    sale.amountPaid = Math.max(0, round2(num(sale.amountPaid) - reverseAmt));
    await sale.save();

    await Transaction.findByIdAndDelete(transactionId);

    return {
      ok: true,
      message: `POS payment reverse ho gaya — ${sale.invoiceNo} se Rs. ${reverseAmt.toLocaleString('en-PK')} hata diya`,
      saleId: sale._id,
      invoiceNo: sale.invoiceNo,
      amountReversed: reverseAmt,
    };
  }

  await Transaction.findByIdAndDelete(transactionId);
  return {
    ok: true,
    message: 'Transaction delete ho gaya (linked POS sale nahi mili)',
  };
}

module.exports = {
  isPosPaymentTransaction,
  reversePosPaymentTransaction,
};
