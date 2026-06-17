const Transaction = require('../models/transaction.model');
const InvestmentAccount = require('../models/investment.model');

const ADVANCE_METHODS = ['drawer', 'easypaisa', 'jazzcash', 'bank'];
const OWNER_ACCOUNT_TYPES = ['advance_to_owner', 'loan_to_owner'];

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function isValidAdvanceMethod(method) {
  return ADVANCE_METHODS.includes(String(method || '').toLowerCase());
}

function getMethodLabel(method) {
  const labels = {
    drawer: 'Cash Drawer',
    easypaisa: 'Easypaisa',
    jazzcash: 'JazzCash',
    bank: 'Bank Account',
  };
  return labels[method] || method;
}

/** Outstanding owner advance from finance ledger */
function syncOwnerAdvanceBalance(account) {
  let balance = 0;
  for (const e of account.financeLedger || []) {
    if (e.type === 'advance') balance += num(e.amount);
    else if (e.type === 'repayment') balance -= num(e.amount);
  }
  account.balance = round2(Math.max(0, balance));
}

/** Keep legacy transactions[] in sync for older ledger views */
function appendLegacyTransaction(account, entry) {
  account.transactions = account.transactions || [];
  account.transactions.push({
    date: entry.date || new Date(),
    type: entry.type === 'advance' ? 'debit' : 'credit',
    amount: num(entry.amount),
    description: entry.description || '',
    reference: entry.reference || '',
    transactionId: entry.transactionId,
  });
}

async function findOwnerAccount(accountId) {
  if (!accountId) return null;
  const account = await InvestmentAccount.findById(accountId);
  if (!account) return null;
  if (!OWNER_ACCOUNT_TYPES.includes(account.accountType)) {
    return null;
  }
  return account;
}

async function getDefaultOwnerAccount() {
  let account = await InvestmentAccount.findOne({
    isActive: true,
    accountType: { $in: OWNER_ACCOUNT_TYPES },
  }).sort({ createdAt: 1 });
  if (!account) {
    account = await InvestmentAccount.create({
      head: 'Investment',
      subHead: 'Loan/Advance to Owner',
      accountName: 'Owner Advances',
      accountType: 'advance_to_owner',
      ownerName: 'Owner',
      balance: 0,
      financeLedger: [],
      transactions: [],
    });
  }
  return account;
}

async function resolveOwnerAccount(accountId) {
  if (accountId) {
    const account = await findOwnerAccount(accountId);
    if (account) return account;
  }
  return getDefaultOwnerAccount();
}

async function listOwnerAdvanceAccounts() {
  const accounts = await InvestmentAccount.find({
    isActive: true,
    accountType: { $in: OWNER_ACCOUNT_TYPES },
  })
    .sort({ accountName: 1 })
    .lean();

  return accounts.map((a) => ({
    _id: a._id,
    accountName: a.accountName,
    ownerName: a.ownerName || '',
    subHead: a.subHead,
    accountType: a.accountType,
    advanceBalance: round2(num(a.balance)),
  }));
}

async function getOwnerLinkedProfile(accountId, query = {}) {
  const account = await resolveOwnerAccount(accountId);
  if (!account) return null;

  const startDate = query.startDate ? new Date(query.startDate) : null;
  const endDate = query.endDate ? new Date(query.endDate) : null;
  if (endDate) endDate.setHours(23, 59, 59, 999);

  let ledgerRaw = (account.financeLedger || []).slice();
  if (startDate || endDate) {
    ledgerRaw = ledgerRaw.filter((e) => {
      const d = new Date(e.date);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }

  const history = ledgerRaw
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((e) => ({
      _id: e._id,
      date: e.date,
      type: e.type,
      amount: num(e.amount),
      method: e.method || '',
      description: e.description || '',
      reference: e.reference || '',
      transactionId: e.transactionId ? String(e.transactionId) : undefined,
      canDelete: !!e.transactionId,
      source: 'finance',
    }));

  const ownerLabel = account.ownerName || account.accountName;

  return {
    owner: {
      _id: account._id,
      accountName: account.accountName,
      ownerName: ownerLabel,
      advanceBalance: round2(num(account.balance)),
      accountType: account.accountType,
    },
    history,
    ledger: history,
  };
}

/** Owner takes advance — withdraw from company account */
async function recordOwnerAdvance({ accountId, ownerName, method, amount, description, reference }) {
  const amt = num(amount);
  if (!isValidAdvanceMethod(method)) {
    return {
      ok: false,
      status: 400,
      message: 'Payment method: drawer, easypaisa, jazzcash ya bank',
    };
  }
  if (amt <= 0) {
    return { ok: false, status: 400, message: 'Valid amount required' };
  }

  const account = await resolveOwnerAccount(accountId);
  if (!account) {
    return { ok: false, status: 404, message: 'Owner advance account not found' };
  }

  if (ownerName?.trim()) {
    account.ownerName = ownerName.trim();
  }

  const balances = await Transaction.getBalances();
  const bucket = method === 'bank' ? 'bank' : method;
  if ((balances[bucket] || 0) < amt) {
    return {
      ok: false,
      status: 400,
      message: `Insufficient balance in ${getMethodLabel(method)}`,
    };
  }

  const label = account.ownerName || account.accountName;
  const ref = reference || `OADV-${Date.now()}`;
  const desc = description?.trim() || `Owner advance: ${label}`;

  const transaction = await Transaction.create({
    type: 'withdraw',
    method,
    amount: amt,
    net: amt,
    description: desc,
    reference: ref,
    status: 'completed',
    partyType: 'owner',
    partyId: account._id,
    partyName: label,
    category: 'advance',
  });

  const ledgerEntry = {
    date: new Date(),
    type: 'advance',
    amount: amt,
    method,
    description: desc,
    reference: ref,
    transactionId: transaction._id,
  };

  account.financeLedger = account.financeLedger || [];
  account.financeLedger.push(ledgerEntry);
  appendLegacyTransaction(account, ledgerEntry);
  syncOwnerAdvanceBalance(account);
  await account.save();

  return {
    ok: true,
    message: `Owner ${label} ko Rs. ${amt.toLocaleString('en-PK')} advance diya (${getMethodLabel(method)})`,
    transaction,
    owner: {
      _id: account._id,
      accountName: account.accountName,
      ownerName: label,
      advanceBalance: account.balance,
    },
  };
}

/** Owner repays advance — deposit to company account */
async function recordOwnerRepayment({ accountId, method, amount, description, reference }) {
  const amt = num(amount);
  if (!isValidAdvanceMethod(method)) {
    return {
      ok: false,
      status: 400,
      message: 'Payment method: drawer, easypaisa, jazzcash ya bank',
    };
  }
  if (amt <= 0) {
    return { ok: false, status: 400, message: 'Valid amount required' };
  }

  const account = await resolveOwnerAccount(accountId);
  if (!account) {
    return { ok: false, status: 404, message: 'Owner advance account not found' };
  }

  const outstanding = num(account.balance);
  if (amt > outstanding + 0.01) {
    return {
      ok: false,
      status: 400,
      message: `Outstanding advance Rs. ${outstanding.toLocaleString('en-PK')} se zyada repay nahi kar sakte`,
    };
  }

  const label = account.ownerName || account.accountName;
  const ref = reference || `OREP-${Date.now()}`;
  const desc = description?.trim() || `Owner advance repayment: ${label}`;

  const transaction = await Transaction.create({
    type: 'deposit',
    method,
    amount: amt,
    net: amt,
    description: desc,
    reference: ref,
    status: 'completed',
    partyType: 'owner',
    partyId: account._id,
    partyName: label,
    category: 'advance',
  });

  const ledgerEntry = {
    date: new Date(),
    type: 'repayment',
    amount: amt,
    method,
    description: desc,
    reference: ref,
    transactionId: transaction._id,
  };

  account.financeLedger = account.financeLedger || [];
  account.financeLedger.push(ledgerEntry);
  appendLegacyTransaction(account, ledgerEntry);
  syncOwnerAdvanceBalance(account);
  await account.save();

  return {
    ok: true,
    message: `Owner ${label} se Rs. ${amt.toLocaleString('en-PK')} wapas receive hua (${getMethodLabel(method)})`,
    transaction,
    owner: {
      _id: account._id,
      accountName: account.accountName,
      ownerName: label,
      advanceBalance: account.balance,
    },
  };
}

module.exports = {
  ADVANCE_METHODS,
  OWNER_ACCOUNT_TYPES,
  isValidAdvanceMethod,
  syncOwnerAdvanceBalance,
  findOwnerAccount,
  resolveOwnerAccount,
  listOwnerAdvanceAccounts,
  getOwnerLinkedProfile,
  recordOwnerAdvance,
  recordOwnerRepayment,
};
