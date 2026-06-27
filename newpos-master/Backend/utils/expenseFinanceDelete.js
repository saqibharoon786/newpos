const Transaction = require('../models/transaction.model');

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function parseExpensePrice(price) {
  return num(String(price || '').replace(/[^\d.]/g, ''));
}

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findFinanceTransactionForExpense(expense) {
  if (!expense) return null;

  if (expense.transactionId) {
    const byId = await Transaction.findById(expense.transactionId);
    if (byId) return byId;
  }

  const byRef = await Transaction.findOne({
    reference: `EXP-${expense._id}`,
    status: 'completed',
  });
  if (byRef) return byRef;

  const priceNum = parseExpensePrice(expense.price);
  if (priceNum <= 0) return null;

  const method = expense.paymentMethod === 'cash' ? 'drawer' : expense.paymentMethod || 'drawer';
  const subject = String(expense.subject || expense.purpose || 'Expense').trim();

  const candidates = await Transaction.find({
    type: 'withdraw',
    method,
    amount: priceNum,
    status: 'completed',
    description: { $regex: new RegExp(`^Expense:\\s*${escapeRegex(subject)}`, 'i') },
  })
    .sort({ date: -1 })
    .lean();

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  if (expense.createdAt) {
    const expTime = new Date(expense.createdAt).getTime();
    let best = candidates[0];
    let bestDiff = Infinity;
    for (const c of candidates) {
      const t = new Date(c.date || c.createdAt).getTime();
      const diff = Math.abs(t - expTime);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = c;
      }
    }
    return best;
  }

  return candidates[0];
}

/**
 * Delete linked Finance withdraw when a Kharcha expense is removed.
 */
async function reverseExpenseFinanceTransaction(expense) {
  const tx = await findFinanceTransactionForExpense(expense);
  if (!tx) {
    return {
      ok: true,
      reversed: false,
      message: 'Expense delete ho gaya (linked Finance entry nahi mili)',
    };
  }

  await Transaction.findByIdAndDelete(tx._id);

  return {
    ok: true,
    reversed: true,
    message: `Kharcha aur Finance se Rs. ${num(tx.amount).toLocaleString('en-PK')} wapas adjust ho gaya`,
    amountReversed: num(tx.amount),
    transactionId: tx._id,
  };
}

module.exports = {
  findFinanceTransactionForExpense,
  reverseExpenseFinanceTransaction,
};
