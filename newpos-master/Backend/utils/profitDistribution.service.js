const Owner = require('../models/owner.model');
const InvestmentAccount = require('../models/investment.model');
const ProfitDistribution = require('../models/profitDistribution.model');
const Transaction = require('../models/transaction.model');
const { calculateNetProfit } = require('./profitCalculator');

const ADVANCE_METHODS = ['drawer', 'easypaisa', 'jazzcash', 'bank'];

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function monthLabel(year, month) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${year}`;
}

function monthRange(year, month) {
  const last = new Date(year, month, 0).getDate();
  const m = String(month).padStart(2, '0');
  return {
    startDate: `${year}-${m}-01`,
    endDate: `${year}-${m}-${String(last).padStart(2, '0')}`,
  };
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

async function ensureOwnerInvestmentAccount(owner) {
  if (owner.investmentAccountId) {
    const acc = await InvestmentAccount.findById(owner.investmentAccountId);
    if (acc) return acc;
  }
  const account = await InvestmentAccount.create({
    head: 'Investment',
    subHead: 'Loan/Advance to Owner',
    accountName: `${owner.name} — Owner Advance`,
    accountType: 'advance_to_owner',
    ownerName: owner.name,
    ownerId: owner._id,
    balance: 0,
    financeLedger: [],
    transactions: [],
  });
  owner.investmentAccountId = account._id;
  await owner.save();
  return account;
}

async function previewProfitDistribution({ year, month, reserveAmount = 0 }) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (!y || !m || m < 1 || m > 12) {
    return { ok: false, status: 400, message: 'Valid year and month required' };
  }

  const { startDate, endDate } = monthRange(y, m);
  const pl = await calculateNetProfit({ startDate, endDate });
  const reserve = round2(Math.max(0, num(reserveAmount)));
  const distributable = round2(Math.max(0, pl.netProfit - reserve));

  const owners = await Owner.find({ isActive: true }).sort({ name: 1 }).lean();
  const totalShare = owners.reduce((s, o) => s + num(o.profitSharePercent), 0);

  const lines = owners.map((o) => {
    const share = num(o.profitSharePercent);
    const amount =
      totalShare > 0 ? round2((distributable * share) / totalShare) : 0;
    return {
      ownerId: o._id,
      ownerName: o.name,
      sharePercent: share,
      amount,
    };
  });

  const existing = await ProfitDistribution.findOne({
    periodYear: y,
    periodMonth: m,
  }).lean();

  return {
    ok: true,
    preview: {
      periodYear: y,
      periodMonth: m,
      periodLabel: monthLabel(y, m),
      startDate,
      endDate,
      totalRevenue: round2(pl.totalRevenue),
      totalMaterialCost: round2(pl.totalMaterialCost),
      grossProfit: round2(pl.grossProfit),
      totalExpenses: round2(pl.totalExpenses),
      netProfit: round2(pl.netProfit),
      reserveAmount: reserve,
      distributableProfit: distributable,
      totalSharePercent: round2(totalShare),
      shareWarning:
        owners.length > 0 && Math.abs(totalShare - 100) > 0.01
          ? `Owner shares total ${totalShare}% (100% hona chahiye)`
          : null,
      lines,
      existingStatus: existing?.status || null,
      existingId: existing?._id || null,
    },
  };
}

async function saveProfitDistributionDraft({ year, month, reserveAmount = 0, notes = '' }) {
  const previewResult = await previewProfitDistribution({ year, month, reserveAmount });
  if (!previewResult.ok) return previewResult;

  const p = previewResult.preview;
  if (p.existingStatus === 'paid') {
    return {
      ok: false,
      status: 400,
      message: `${p.periodLabel} ka profit pehle distribute ho chuka hai`,
    };
  }

  const doc = await ProfitDistribution.findOneAndUpdate(
    { periodYear: p.periodYear, periodMonth: p.periodMonth },
    {
      periodLabel: p.periodLabel,
      startDate: p.startDate,
      endDate: p.endDate,
      totalRevenue: p.totalRevenue,
      totalMaterialCost: p.totalMaterialCost,
      grossProfit: p.grossProfit,
      totalExpenses: p.totalExpenses,
      netProfit: p.netProfit,
      reserveAmount: p.reserveAmount,
      distributableProfit: p.distributableProfit,
      status: 'draft',
      lines: p.lines.map((l) => ({ ...l, amount: l.amount })),
      notes: notes || '',
    },
    { upsert: true, new: true }
  );

  return { ok: true, distribution: doc, preview: p };
}

async function payProfitDistribution({ distributionId, method, linePayments = [] }) {
  const payMethod = String(method || 'drawer').toLowerCase();
  if (!ADVANCE_METHODS.includes(payMethod)) {
    return { ok: false, status: 400, message: 'Payment method: drawer, easypaisa, jazzcash ya bank' };
  }

  const dist = await ProfitDistribution.findById(distributionId);
  if (!dist) return { ok: false, status: 404, message: 'Distribution not found' };
  if (dist.status === 'paid') {
    return { ok: false, status: 400, message: 'Pehle hi pay ho chuka hai' };
  }
  if (!dist.lines?.length) {
    return { ok: false, status: 400, message: 'Koi owner line nahi — pehle preview save karen' };
  }

  const balances = await Transaction.getBalances();
  const bucket = payMethod === 'bank' ? 'bank' : payMethod;
  const totalPay = dist.lines.reduce((s, l) => s + num(l.amount), 0);
  if ((balances[bucket] || 0) < totalPay - 0.01) {
    return {
      ok: false,
      status: 400,
      message: `Insufficient balance in ${getMethodLabel(payMethod)} (need Rs. ${totalPay.toLocaleString('en-PK')})`,
    };
  }

  const refBase = `PD-${dist.periodYear}${String(dist.periodMonth).padStart(2, '0')}`;

  for (let i = 0; i < dist.lines.length; i++) {
    const line = dist.lines[i];
    const amt = round2(num(line.amount));
    if (amt <= 0) continue;

    const lineMethod =
      linePayments.find((lp) => String(lp.ownerId) === String(line.ownerId))?.method ||
      payMethod;

    const owner = await Owner.findById(line.ownerId);
    if (!owner) continue;

    const account = await ensureOwnerInvestmentAccount(owner);
    const desc = `Profit share ${dist.periodLabel} — ${owner.name} (${line.sharePercent}%)`;
    const ref = `${refBase}-${owner.ownerCode || i + 1}`;

    const transaction = await Transaction.create({
      type: 'withdraw',
      method: lineMethod,
      amount: amt,
      net: amt,
      description: desc,
      reference: ref,
      status: 'completed',
      partyType: 'owner',
      partyId: owner._id,
      partyName: owner.name,
      category: 'profit_distribution',
    });

    const ledgerEntry = {
      date: new Date(),
      type: 'profit_payout',
      amount: amt,
      method: lineMethod,
      description: desc,
      reference: ref,
      transactionId: transaction._id,
    };

    account.financeLedger = account.financeLedger || [];
    account.financeLedger.push(ledgerEntry);
    account.transactions = account.transactions || [];
    account.transactions.push({
      date: new Date(),
      type: 'debit',
      amount: amt,
      description: desc,
      reference: ref,
      transactionId: transaction._id,
    });
    await account.save();

    owner.totalProfitReceived = round2(num(owner.totalProfitReceived) + amt);
    await owner.save();

    line.method = lineMethod;
    line.transactionId = transaction._id;
    line.paidAt = new Date();
  }

  dist.status = 'paid';
  dist.paidAt = new Date();
  await dist.save();

  return {
    ok: true,
    message: `${dist.periodLabel} ka profit Rs. ${totalPay.toLocaleString('en-PK')} owners ko distribute ho gaya`,
    distribution: dist,
  };
}

async function listProfitDistributions(query = {}) {
  const filter = {};
  if (query.year) filter.periodYear = parseInt(query.year, 10);
  return ProfitDistribution.find(filter).sort({ periodYear: -1, periodMonth: -1 }).lean();
}

module.exports = {
  previewProfitDistribution,
  saveProfitDistributionDraft,
  payProfitDistribution,
  listProfitDistributions,
  ensureOwnerInvestmentAccount,
  monthRange,
  monthLabel,
};
