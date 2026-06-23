const Expense = require('../models/expense.model');
const ledgerService = require('./ledgerService');
const { PRODUCT_CODES } = require('../constants/productCodes');

function parseMoney(val) {
  if (val == null) return 0;
  return parseFloat(String(val).replace(/,/g, '')) || 0;
}

function round2(v) {
  return Math.round((parseFloat(v) || 0) * 100) / 100;
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

function isInYmdRange(dateField, startYmd, endYmd) {
  const ymd = parseYmd(dateField);
  if (!ymd) return false;
  return ymd >= startYmd && ymd <= endYmd;
}

function mapExpenseRow(e) {
  return {
    _id: e._id,
    date: e.date,
    category: e.category || 'General',
    subject: e.subject,
    description: e.description,
    purpose: e.purpose,
    usage: e.usage,
    priceRs: parseMoney(e.price),
    personResponsible: e.personResponsible,
  };
}

function parseSalePrices(query) {
  const raw = query?.salePrices;
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch (_) {
    return {};
  }
}

/**
 * Profit on production basis — same formula as Reports → Profit Calculation:
 * Total Gross Profit = Σ(productionKg × (salePricePerKg − avgCostPerKg))
 * Net Profit = Total Gross Profit − expenses
 */
async function calculateProductionBasisProfit({ startDate, endDate, salePrices = {} } = {}) {
  const fpQuery =
    startDate && endDate
      ? { startDate, endDate }
      : { startDate: '1970-01-01', endDate: '2099-12-31' };

  const fpData = await ledgerService.getFpSummary(fpQuery);

  const allExpenses = await Expense.find().lean();
  const expenses =
    startDate && endDate
      ? allExpenses
          .filter((e) => isInYmdRange(e.date, startDate, endDate))
          .map(mapExpenseRow)
      : allExpenses.map(mapExpenseRow);

  const totalExpensesRs = round2(expenses.reduce((s, e) => s + e.priceRs, 0));

  const rows = PRODUCT_CODES.map((p) => {
    const fpRow = fpData.rows.find((r) => String(r.code) === p.code) || {};
    const productionKg = round2(fpRow.production || 0);
    const avgCostPerKg = round2(fpRow.avgRate || 0);
    const saleRaw = salePrices[p.code];
    const salePricePerKg =
      saleRaw != null && saleRaw !== '' ? round2(parseMoney(saleRaw)) : null;
    const grossProfitPerKg =
      salePricePerKg != null ? round2(salePricePerKg - avgCostPerKg) : null;
    const totalGrossProfit =
      grossProfitPerKg != null ? round2(productionKg * grossProfitPerKg) : null;

    return {
      code: p.code,
      itemName: p.materialName,
      productionKg,
      avgCostPerKg,
      salePricePerKg,
      grossProfitPerKg,
      totalGrossProfit,
    };
  });

  const totalGrossProfitRs = round2(
    rows.reduce((s, r) => s + (r.totalGrossProfit || 0), 0)
  );
  const netProfitRs = round2(totalGrossProfitRs - totalExpensesRs);

  return {
    rows,
    totalGrossProfitRs,
    totalExpensesRs,
    netProfitRs,
    expenseCount: expenses.length,
    expenses,
  };
}

module.exports = {
  calculateProductionBasisProfit,
  parseSalePrices,
};
