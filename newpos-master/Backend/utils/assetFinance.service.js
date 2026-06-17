const Transaction = require('../models/transaction.model');

const BANK_METHODS = ['bank', 'bank_transfer', 'cheque', 'online'];
const SUPPORTED_METHODS = ['drawer', 'bank', 'easypaisa', 'jazzcash', 'bank_transfer', 'cheque', 'online'];

function normalizeAssetPaymentMethod(raw) {
  const r = String(raw || 'cash').toLowerCase().trim();
  if (r === 'cash') return 'drawer';
  if (SUPPORTED_METHODS.includes(r)) return r;
  return 'drawer';
}

function getBalanceKey(method) {
  const m = normalizeAssetPaymentMethod(method);
  if (BANK_METHODS.includes(m)) return 'bank';
  return m;
}

async function checkSufficientBalance(method, amount, creditBack = 0) {
  const key = getBalanceKey(method);
  const balances = await Transaction.getBalances();
  const available = (balances[key] || 0) + (Number(creditBack) || 0);
  if (available < amount) {
    return {
      ok: false,
      balanceKey: key,
      available: balances[key] || 0,
    };
  }
  return { ok: true, balanceKey: key, available };
}

async function recordAssetWithdraw({
  amount,
  paymentMethod,
  date,
  description,
  reference,
  assetId,
  assetName,
}) {
  const amt = Number(amount);
  if (!amt || amt <= 0) return null;

  const method = normalizeAssetPaymentMethod(paymentMethod);
  const check = await checkSufficientBalance(method, amt);
  if (!check.ok) {
    const err = new Error(
      `Insufficient ${check.balanceKey} balance. Available: Rs. ${(check.available || 0).toLocaleString()}`
    );
    err.statusCode = 400;
    throw err;
  }

  return Transaction.create({
    type: 'withdraw',
    method,
    amount: amt,
    net: amt,
    date: date || new Date(),
    description: description || `Asset: ${assetName || 'Purchase'}`,
    reference: reference || (assetId ? `asset:${assetId}` : undefined),
    status: 'completed',
    partyType: assetId ? 'asset' : undefined,
    partyId: assetId || undefined,
    partyName: assetName || undefined,
    category: 'asset_purchase',
  });
}

async function findPrimaryAssetTransaction(assetId, invoiceNo) {
  let tx = await Transaction.findOne({
    partyType: 'asset',
    partyId: assetId,
    category: 'asset_purchase',
  }).sort({ createdAt: 1 });

  if (!tx && invoiceNo) {
    tx = await Transaction.findOne({ reference: invoiceNo });
  }
  return tx;
}

async function deleteAssetTransactions(assetId, invoiceNo) {
  const or = [{ partyType: 'asset', partyId: assetId }];
  if (invoiceNo) or.push({ reference: invoiceNo });
  await Transaction.deleteMany({ $or: or });
}

function formatPaymentMethodLabel(method) {
  const m = normalizeAssetPaymentMethod(method);
  const labels = {
    drawer: 'Cash (Drawer)',
    bank: 'Bank',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
    online: 'Online',
    easypaisa: 'Easypaisa',
    jazzcash: 'JazzCash',
  };
  return labels[m] || m;
}

module.exports = {
  normalizeAssetPaymentMethod,
  getBalanceKey,
  checkSufficientBalance,
  recordAssetWithdraw,
  findPrimaryAssetTransaction,
  deleteAssetTransactions,
  formatPaymentMethodLabel,
  SUPPORTED_METHODS,
  BANK_METHODS,
};
