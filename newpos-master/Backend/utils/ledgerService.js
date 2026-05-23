const Purchase = require('../models/pop.model');
const Sale = require('../models/pos.model');
const Vendor = require('../models/vendor.model');
const Customer = require('../models/customer.model');
const Employee = require('../models/employee.model');
const InvestmentAccount = require('../models/investment.model');
const { ProductionData } = require('../models/process.model');
const { PRODUCT_CODES, getMaterialNameForCode } = require('../constants/productCodes');

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(v) {
  return Math.round(num(v) * 100) / 100;
}

function parseYmd(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dm) {
    const [, d, m, y] = dm;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  try {
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) {
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

function parseDateField(dateField) {
  const ymd = parseYmd(dateField);
  if (ymd) return ymd;
  if (!dateField) return null;
  const dt = new Date(dateField);
  if (Number.isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function inRange(ymd, startYmd, endYmd) {
  if (!ymd) return false;
  if (startYmd && ymd < startYmd) return false;
  if (endYmd && ymd > endYmd) return false;
  return true;
}

function defaultMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  return {
    startDate: `${y}-${String(m).padStart(2, '0')}-01`,
    endDate: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
  };
}

function resolveRange(query) {
  const { startDate, endDate } = query || {};
  if (startDate && endDate) return { startDate, endDate };
  return defaultMonthRange();
}

/** RM qty movements for one product code */
function aggregateRmForCode(purchases, productions, salesFromPop, code, startYmd, endYmd) {
  let openingQty = 0;
  let purchaseQty = 0;
  let issueQty = 0;
  let saleQty = 0;
  let purchaseAmount = 0;

  for (const p of purchases) {
    const pYmd = parseYmd(p.purchaseDate);
    const mats = p.materials || [];
    if (mats.length === 0) {
      const lineCode = String(p.materialName || '').includes(code) ? code : '';
      if (!lineCode && code !== '100') continue;
      const w = num(p.weight);
      const consumed = num(p.productionConsumedWeight);
      const sold = num(p.soldWeight);
      const remaining = Math.max(0, w - consumed - sold);
      if (inRange(pYmd, null, startYmd ? addDayBefore(startYmd) : null)) {
        openingQty += remaining;
      } else if (inRange(pYmd, startYmd, endYmd)) {
        purchaseQty += w;
        purchaseAmount += num(p.price);
      }
      continue;
    }

    for (const m of mats) {
      if (String(m.productCode || '').trim() !== code) continue;
      const w = num(m.weight);
      const consumed = num(m.productionConsumedWeight);
      const lineRem = Math.max(0, w - consumed);
      const rate = num(m.pricePerKg);
      if (pYmd && startYmd && pYmd < startYmd) {
        openingQty += lineRem;
      } else if (inRange(pYmd, startYmd, endYmd)) {
        purchaseQty += w;
        purchaseAmount += num(m.totalAmount) || w * rate;
      }
    }
  }

  for (const prod of productions) {
    if (String(prod.productCode || '').trim() !== code) continue;
    const ymd = parseDateField(prod.productionDate);
    const kg = num(prod.weightUsedFromPOP) || num(prod.totalWeight);
    if (ymd && startYmd && ymd < startYmd) {
      openingQty = Math.max(0, openingQty - kg);
    } else if (inRange(ymd, startYmd, endYmd)) {
      issueQty += kg;
    }
  }

  for (const s of salesFromPop) {
    if (!s.purchaseId) continue;
    const ymd = parseYmd(s.purchaseDate);
    const kg = num(s.weight);
    if (ymd && startYmd && ymd < startYmd) {
      openingQty = Math.max(0, openingQty - kg);
    } else if (inRange(ymd, startYmd, endYmd)) {
      saleQty += kg;
    }
  }

  const balance = round2(openingQty + purchaseQty - issueQty - saleQty);
  const avgRate = purchaseQty > 0 ? round2(purchaseAmount / purchaseQty) : 0;

  return {
    code,
    itemName: getMaterialNameForCode(code),
    type: 'RM',
    openingQty: round2(openingQty),
    purchase: round2(purchaseQty),
    issue: round2(issueQty),
    sale: round2(saleQty),
    avgRate,
    balance,
  };
}

function addDayBefore(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

async function getRmSummary(query) {
  const { startDate, endDate } = resolveRange(query);
  const [purchases, productions, sales] = await Promise.all([
    Purchase.find().lean(),
    ProductionData.find().lean(),
    Sale.find({ purchaseId: { $exists: true, $ne: null } }).lean(),
  ]);

  const rows = PRODUCT_CODES.map((p) =>
    aggregateRmForCode(purchases, productions, sales, p.code, startDate, endDate)
  );

  return { startDate, endDate, rows };
}

async function getRmDetail(code, query) {
  const { startDate, endDate } = resolveRange(query);
  const [purchases, productions, sales] = await Promise.all([
    Purchase.find().lean(),
    ProductionData.find({ productCode: code }).lean(),
    Sale.find({ purchaseId: { $exists: true, $ne: null } }).lean(),
  ]);

  const summary = aggregateRmForCode(purchases, productions, sales, code, startDate, endDate);
  const entries = [];

  for (const p of purchases) {
    const pYmd = parseYmd(p.purchaseDate);
    if (!inRange(pYmd, startDate, endDate)) continue;
    const mats = (p.materials || []).filter((m) => String(m.productCode || '').trim() === code);
    if (mats.length === 0) continue;
    for (const m of mats) {
      const qty = num(m.weight);
      const rate = num(m.pricePerKg);
      entries.push({
        date: pYmd,
        description: `Purchase ${p.invoiceNo || p.receiptNo || ''} — ${p.vendor}`,
        purchasedQty: qty,
        purchasedRate: rate,
        purchasedAmount: round2(num(m.totalAmount) || qty * rate),
        issuedQty: 0,
        sortKey: `${pYmd}P${p._id}`,
      });
    }
  }

  for (const prod of productions) {
    const ymd = parseDateField(prod.productionDate);
    if (!inRange(ymd, startDate, endDate)) continue;
    const kg = num(prod.weightUsedFromPOP) || num(prod.totalWeight);
    entries.push({
      date: ymd,
      description: `Issue to Process — Batch ${prod.batchNo || ''}`,
      purchasedQty: 0,
      purchasedRate: 0,
      purchasedAmount: 0,
      issuedQty: kg,
      sortKey: `${ymd}I${prod._id}`,
    });
  }

  entries.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.sortKey).localeCompare(String(b.sortKey)));

  let closing = summary.openingQty;
  const lines = entries.map((e) => {
    closing = round2(closing + e.purchasedQty - e.issuedQty);
    return { ...e, closingQty: closing };
  });

  return {
    startDate,
    endDate,
    code,
    itemName: `${code} — ${getMaterialNameForCode(code)} (RM)`,
    openingQty: summary.openingQty,
    lines,
    closingQty: lines.length ? lines[lines.length - 1].closingQty : summary.openingQty,
  };
}

function aggregateFpForCode(productions, sales, code, startYmd, endYmd) {
  let openingQty = 0;
  let productionQty = 0;
  let saleQty = 0;
  let productionAmount = 0;

  for (const prod of productions) {
    if (String(prod.productCode || '').trim() !== code) continue;
    const ymd = parseDateField(prod.productionDate);
    const total = num(prod.totalWeight);
    const avail = prod.availableWeight != null ? num(prod.availableWeight) : total;
    const soldFromBatch = Math.max(0, total - avail);
    const rate = total > 0 ? num(prod.totalProductionCost) / total : 0;

    if (ymd && startYmd && ymd < startYmd) {
      openingQty += avail;
    } else if (inRange(ymd, startYmd, endYmd)) {
      productionQty += total;
      productionAmount += num(prod.totalProductionCost);
    }
  }

  for (const s of sales) {
    if (!s.productionId && !s.materialName) continue;
    const ymd = parseYmd(s.purchaseDate);
    if (!inRange(ymd, startYmd, endYmd)) continue;
    if (s.productionId) {
      saleQty += num(s.weight);
    }
  }

  const balance = round2(openingQty + productionQty - saleQty);
  const avgRate = productionQty > 0 ? round2(productionAmount / productionQty) : 0;

  return {
    code,
    itemName: getMaterialNameForCode(code),
    type: 'FP',
    openingQty: round2(openingQty),
    production: round2(productionQty),
    sale: round2(saleQty),
    avgRate,
    balance,
  };
}

async function getFpSummary(query) {
  const { startDate, endDate } = resolveRange(query);
  const [productions, sales] = await Promise.all([
    ProductionData.find().lean(),
    Sale.find().lean(),
  ]);

  const rows = PRODUCT_CODES.map((p) =>
    aggregateFpForCode(productions, sales, p.code, startDate, endDate)
  );

  return { startDate, endDate, rows };
}

async function getFpDetail(code, query) {
  const { startDate, endDate } = resolveRange(query);
  const productions = await ProductionData.find({ productCode: code }).lean();
  const prodIds = new Set(productions.map((p) => String(p._id)));
  const sales = await Sale.find({ productionId: { $in: [...prodIds] } }).lean();

  const summary = aggregateFpForCode(productions, sales, code, startDate, endDate);
  const entries = [];

  for (const prod of productions) {
    const ymd = parseDateField(prod.productionDate);
    if (!inRange(ymd, startDate, endDate)) continue;
    const qty = num(prod.totalWeight);
    const rate = qty > 0 ? round2(num(prod.totalProductionCost) / qty) : 0;
    entries.push({
      date: ymd,
      description: `Production — Batch ${prod.batchNo || ''} (${prod.materialName})`,
      receivedQty: qty,
      receivedRate: rate,
      receivedAmount: round2(num(prod.totalProductionCost)),
      saleQty: 0,
      saleRate: 0,
      sortKey: `${ymd}R${prod._id}`,
    });
  }

  for (const s of sales) {
    const ymd = parseYmd(s.purchaseDate);
    if (!inRange(ymd, startDate, endDate)) continue;
    const qty = num(s.weight);
    const bill = num(s.finalAmount) || num(s.sellingPrice);
    const rate = qty > 0 ? round2(bill / qty) : 0;
    entries.push({
      date: ymd,
      description: `Sale ${s.invoiceNo || ''} — ${s.buyerName || ''}`,
      receivedQty: 0,
      receivedRate: 0,
      receivedAmount: 0,
      saleQty: qty,
      saleRate: rate,
      sortKey: `${ymd}S${s._id}`,
    });
  }

  entries.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.sortKey).localeCompare(String(b.sortKey)));

  let closing = summary.openingQty;
  const lines = entries.map((e) => {
    closing = round2(closing + e.receivedQty - e.saleQty);
    return { ...e, closingQty: closing };
  });

  return {
    startDate,
    endDate,
    code,
    itemName: `${code} — ${getMaterialNameForCode(code)} (FP)`,
    openingQty: summary.openingQty,
    lines,
    closingQty: lines.length ? lines[lines.length - 1].closingQty : summary.openingQty,
  };
}

async function getPurchaseTransactionLedger(query) {
  const { startDate, endDate } = resolveRange(query);
  const purchases = await Purchase.find().sort({ purchaseDate: 1 }).lean();

  let closing = 0;
  const rows = [];

  for (const p of purchases) {
    const ymd = parseYmd(p.purchaseDate);
    if (!inRange(ymd, startDate, endDate)) continue;
    const amount = num(p.price);
    const paid = num(p.amountPaid) || num(p.totalPaid);
    const qty = num(p.weight);
    const rate = qty > 0 ? round2(amount / qty) : 0;
    closing = round2(closing + amount - paid);
    rows.push({
      date: ymd,
      invoiceNo: p.invoiceNo || p.receiptNo || '—',
      description: p.materialName,
      vendor: p.vendor,
      qty: round2(qty),
      rate,
      amount: round2(amount),
      paid: round2(paid),
      closing: closing,
    });
  }

  return { startDate, endDate, rows };
}

async function getSalesTransactionLedger(query) {
  const { startDate, endDate } = resolveRange(query);
  const sales = await Sale.find().sort({ purchaseDate: 1, createdAt: 1 }).lean();

  let closing = 0;
  const rows = [];

  for (const s of sales) {
    const ymd = parseYmd(s.purchaseDate);
    if (!inRange(ymd, startDate, endDate)) continue;
    const amount = num(s.finalAmount) || num(s.sellingPrice);
    const paid = num(s.amountPaid);
    const qty = num(s.weight);
    const rate = qty > 0 ? round2(amount / qty) : num(s.sellingPricePerKg);
    closing = round2(closing + amount - paid);
    rows.push({
      date: ymd,
      invoiceNo: s.invoiceNo || '—',
      description: s.materialName,
      customer: s.buyerName || '—',
      qty: round2(qty),
      rate,
      amount: round2(amount),
      paid: round2(paid),
      closing,
    });
  }

  return { startDate, endDate, rows };
}

function formatVendorLedgerRows(ledger, startYmd, endYmd) {
  const sorted = (ledger || [])
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let openingBalance = 0;
  const beforePeriod = [];
  const inPeriod = [];

  for (const e of sorted) {
    const ymd = parseDateField(e.date);
    const debitPay =
      e.type === 'payment' || e.type === 'apply_advance' ? num(e.credit) : 0;
    const creditPurch = e.type === 'purchase' ? num(e.debit) : 0;
    const row = {
      date: ymd || parseDateField(e.date),
      invoiceNo: e.purchaseId ? String(e.purchaseId).slice(-6) : '—',
      description: e.description || e.type,
      debit: round2(debitPay),
      credit: round2(creditPurch),
      type: e.type,
    };
    if (startYmd && ymd && ymd < startYmd) {
      beforePeriod.push(row);
      openingBalance = round2(openingBalance - debitPay + creditPurch);
    } else if (!startYmd || !endYmd || inRange(ymd, startYmd, endYmd)) {
      inPeriod.push(row);
    }
  }

  let balance = openingBalance;
  const lines = inPeriod.map((row) => {
    balance = round2(balance - row.debit + row.credit);
    return { ...row, balance };
  });

  return { openingBalance: round2(openingBalance), lines };
}

async function getVendorLedger(vendorId, query) {
  const { startDate, endDate } = resolveRange(query);
  const vendor = await Vendor.findById(vendorId).lean();
  if (!vendor) return null;

  const { openingBalance, lines } = formatVendorLedgerRows(vendor.ledger, startDate, endDate);

  return {
    startDate,
    endDate,
    vendor: { _id: vendor._id, name: vendor.name },
    openingBalance,
    advanceBalance: round2(vendor.advanceBalance),
    payableBalance: round2(vendor.payableBalance),
    lines,
    closingBalance: lines.length ? lines[lines.length - 1].balance : openingBalance,
  };
}

async function getCustomerLedger(customerId, query) {
  const { startDate, endDate } = resolveRange(query);
  let customer = await Customer.findById(customerId).lean();
  if (!customer) {
    customer = await Customer.findOne({ customerId: String(customerId) }).lean();
  }
  if (!customer) return null;

  const sales = await Sale.find({
    $or: [{ customerId: customer._id }, { buyerName: customer.customerName }],
  })
    .sort({ createdAt: 1 })
    .lean();

  const entries = [];

  for (const s of sales) {
    const ymd = parseYmd(s.purchaseDate);
    const bill = num(s.finalAmount) || num(s.sellingPrice);
    const paid = num(s.amountPaid);
    entries.push({
      date: ymd,
      invoiceNo: s.invoiceNo || '—',
      description: `Sale — ${s.materialName || ''}`,
      debit: round2(bill),
      credit: round2(paid),
      sortKey: `${ymd}S${s._id}`,
    });
  }

  for (const a of customer.advanceLedger || []) {
    const ymd = parseDateField(a.date);
    entries.push({
      date: ymd,
      invoiceNo: a.reference || '—',
      description: a.description || 'Advance (Finance)',
      debit: 0,
      credit: round2(a.amount),
      sortKey: `${ymd}A${a._id || a.reference}`,
    });
  }

  entries.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.sortKey).localeCompare(String(b.sortKey)));

  let openingBalance = 0;
  const inPeriod = [];
  for (const e of entries) {
    if (startDate && e.date && e.date < startDate) {
      openingBalance = round2(openingBalance + e.debit - e.credit);
    } else if (inRange(e.date, startDate, endDate)) {
      inPeriod.push(e);
    }
  }

  let balance = openingBalance;
  const lines = inPeriod.map((row) => {
    balance = round2(balance + row.debit - row.credit);
    return { ...row, balance };
  });

  return {
    startDate,
    endDate,
    customer: { _id: customer._id, name: customer.customerName },
    openingBalance: round2(openingBalance),
    financeAdvanceBalance: round2(customer.financeAdvanceBalance),
    lines,
    closingBalance: lines.length ? lines[lines.length - 1].balance : openingBalance,
  };
}

async function getOwnerAdvanceLedger(query) {
  const { startDate, endDate } = resolveRange(query);
  const accounts = await InvestmentAccount.find({
    isActive: true,
    accountType: { $in: ['advance_to_owner', 'loan_to_owner'] },
  }).lean();

  const allLines = [];
  for (const acc of accounts) {
    for (const t of acc.transactions || []) {
      const ymd = parseDateField(t.date);
      if (!inRange(ymd, startDate, endDate)) continue;
      const amt = num(t.amount);
      const debit = t.type === 'debit' ? amt : 0;
      const credit = t.type === 'credit' ? amt : 0;
      allLines.push({
        date: ymd,
        voucherNo: t.reference || acc.accountName,
        description: t.description || acc.subHead,
        debit: round2(debit),
        credit: round2(credit),
        accountName: acc.accountName,
        sortKey: `${ymd}${acc._id}${t._id}`,
      });
    }
  }

  allLines.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.sortKey).localeCompare(String(b.sortKey)));

  let openingBalance = 0;
  for (const acc of accounts) {
    openingBalance += num(acc.balance);
  }

  let balance = 0;
  const lines = allLines.map((row) => {
    balance = round2(balance + row.debit - row.credit);
    return { ...row, balance };
  });

  return {
    startDate,
    endDate,
    openingBalance: round2(accounts.reduce((s, a) => s + num(a.balance), 0)),
    lines,
    closingBalance: lines.length ? lines[lines.length - 1].balance : 0,
    accounts: accounts.map((a) => ({
      _id: a._id,
      accountName: a.accountName,
      balance: round2(a.balance),
    })),
  };
}

async function getEmployeeAdvanceLedger(employeeId, query) {
  const { startDate, endDate } = resolveRange(query);
  const employee = await Employee.findById(employeeId).lean();
  if (!employee) return null;

  const lines = [];
  const adv = num(employee.advancePayment);
  if (adv > 0) {
    lines.push({
      date: parseDateField(employee.hireDate) || startDate,
      voucherNo: employee.employeeId,
      description: 'Advance on record (opening)',
      debit: round2(adv),
      credit: 0,
      balance: round2(adv),
    });
  }

  return {
    startDate,
    endDate,
    employee: { _id: employee._id, name: employee.name, employeeId: employee.employeeId },
    openingBalance: round2(adv),
    lines,
    closingBalance: round2(adv),
    note: 'Employee advance history — add transactions via Employee module when available.',
  };
}

module.exports = {
  resolveRange,
  defaultMonthRange,
  getRmSummary,
  getRmDetail,
  getFpSummary,
  getFpDetail,
  getPurchaseTransactionLedger,
  getSalesTransactionLedger,
  getVendorLedger,
  getCustomerLedger,
  getOwnerAdvanceLedger,
  getEmployeeAdvanceLedger,
};
