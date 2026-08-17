const Purchase = require('../models/pop.model');
const Sale = require('../models/pos.model');
const Expense = require('../models/expense.model');
const { ProductionData } = require('../models/process.model');
const Customer = require('../models/customer.model');
const { calculateNetProfit } = require('../utils/profitCalculator');
const { calculateProductionBasisProfit, parseSalePrices } = require('../utils/productionBasisProfit');
const { computeProductionCosts } = require('../utils/productionCost');
const { getPopLinePricing } = require('../utils/popMaterialConsumption');

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

function isOnDate(dateField, targetYmd) {
  const ymd = parseYmd(dateField);
  return ymd === targetYmd;
}

function dayRange(targetYmd) {
  const [y, m, d] = targetYmd.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { start, end };
}

function ymdRangeToDates(startYmd, endYmd) {
  const [sy, sm, sd] = startYmd.split('-').map(Number);
  const [ey, em, ed] = endYmd.split('-').map(Number);
  return {
    start: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
    end: new Date(ey, em - 1, ed, 23, 59, 59, 999),
  };
}

function isInYmdRange(dateField, startYmd, endYmd) {
  const ymd = parseYmd(dateField);
  if (!ymd) return false;
  return ymd >= startYmd && ymd <= endYmd;
}

function periodToRange(query) {
  const { period = 'daily', date, month, year, startDate, endDate } = query;
  const now = new Date();
  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  if (period === 'monthly') {
    const mm = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const parts = mm.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const last = new Date(y, m, 0).getDate();
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    return { startDate: start, endDate: end, period: 'monthly', label: mm };
  }

  if (period === 'yearly') {
    const y = parseInt(year || String(now.getFullYear()), 10);
    return {
      startDate: `${y}-01-01`,
      endDate: `${y}-12-31`,
      period: 'yearly',
      label: String(y),
    };
  }

  if (period === 'custom') {
    const s = parseYmd(startDate) || todayYmd;
    const e = parseYmd(endDate) || todayYmd;
    return { startDate: s, endDate: e, period: 'custom', label: `${s} — ${e}` };
  }

  const d = parseYmd(date) || todayYmd;
  return { startDate: d, endDate: d, period: 'daily', label: d };
}

function parseMoney(val) {
  if (val == null) return 0;
  return parseFloat(String(val).replace(/,/g, '')) || 0;
}

function mapPurchaseRow(p) {
  const weightKg = parseFloat(p.weight) || 0;
  const priceRs = parseMoney(p.price);
  const materials = (p.materials || []).map((m) => {
    const w = parseFloat(m.weight) || 0;
    const ppk = parseFloat(m.pricePerKg) || 0;
    return {
      name: m.name || m.materialName || '—',
      productCode: m.productCode || '',
      weightKg: w,
      pricePerKg: ppk,
      totalRs: parseMoney(m.totalAmount) || w * ppk,
    };
  });
  const avgFromMaterials =
    materials.length > 0
      ? materials.reduce((s, m) => s + m.pricePerKg, 0) / materials.length
      : 0;
  const pricePerKg =
    weightKg > 0 ? Math.round((priceRs / weightKg) * 100) / 100 : avgFromMaterials;

  return {
    _id: p._id,
    date: p.purchaseDate,
    receiptNo: p.receiptNo || p.invoiceNo || '—',
    vendor: p.vendor,
    materialName: p.materialName,
    weightKg: Math.round(weightKg * 100) / 100,
    priceRs: Math.round(priceRs * 100) / 100,
    pricePerKg: Math.round(pricePerKg * 100) / 100,
    materials,
    productionConsumedKg: parseFloat(p.productionConsumedWeight) || 0,
    soldWeightKg: parseFloat(p.soldWeight) || 0,
    remainingKg: parseFloat(p.remainingWeight) || Math.max(0, weightKg - (parseFloat(p.soldWeight) || 0) - (parseFloat(p.productionConsumedWeight) || 0)),
  };
}

function resolveProductionCosts(p, pop) {
  const inputKg = parseFloat(p.weightUsedFromPOP) || 0;
  const outputKg = parseFloat(p.totalWeight) || 0;
  const wasteKg = parseFloat(p.wasteWeight) || 0;
  const laborCostPerKg = parseFloat(p.laborCostPerKg) || 0;
  let materialCostRs = parseFloat(p.materialCost) || 0;
  let wasteCostRs = parseFloat(p.wasteCost) || 0;
  let totalProductionCostRs = parseFloat(p.totalProductionCost) || 0;

  if (totalProductionCostRs > 0) {
    return {
      materialCostRs: Math.round(materialCostRs * 100) / 100,
      wasteCostRs: Math.round(wasteCostRs * 100) / 100,
      totalProductionCostRs: Math.round(totalProductionCostRs * 100) / 100,
    };
  }

  let purchasePrice = parseFloat(p.popLinePurchasePrice) || 0;
  let purchaseWeight = parseFloat(p.popLinePurchaseWeight) || 0;
  if ((!purchasePrice || !purchaseWeight) && pop) {
    const pricing = getPopLinePricing(pop, p.productCode, p.materialLineIndex);
    purchasePrice = pricing.purchasePrice;
    purchaseWeight = pricing.purchaseWeight;
  }

  const computed = computeProductionCosts({
    purchasePrice,
    purchaseWeight,
    weightUsedFromPOP: inputKg,
    outputWeight: outputKg,
    wasteWeight: wasteKg,
    laborCostPerKg,
    materialCost: materialCostRs || undefined,
    wasteCost: wasteCostRs || undefined,
  });

  return {
    materialCostRs: computed.materialCost,
    wasteCostRs: computed.wasteCost,
    totalProductionCostRs: computed.totalProductionCost,
  };
}

function mapProductionRow(p, pop) {
  const inputKg = parseFloat(p.weightUsedFromPOP) || 0;
  const outputKg = parseFloat(p.totalWeight) || 0;
  const wasteKg = parseFloat(p.wasteWeight) || 0;
  const prodDate = p.productionDate instanceof Date ? p.productionDate : new Date(p.productionDate);
  const dateStr = `${prodDate.getFullYear()}-${String(prodDate.getMonth() + 1).padStart(2, '0')}-${String(prodDate.getDate()).padStart(2, '0')}`;
  const costs = resolveProductionCosts(p, pop);

  return {
    _id: p._id,
    date: dateStr,
    batchNo: p.batchNo,
    materialName: p.materialName,
    quality: p.quality,
    purchaseId: p.purchaseId,
    inputKg: Math.round(inputKg * 100) / 100,
    outputKg: Math.round(outputKg * 100) / 100,
    wasteKg: Math.round(wasteKg * 100) / 100,
    yieldPercent: inputKg > 0 ? Math.round((outputKg / inputKg) * 10000) / 100 : 0,
    bags: p.totalBags || 0,
    machine: p.machine,
    shift: p.shift,
    materialCostRs: costs.materialCostRs,
    wasteCostRs: costs.wasteCostRs,
    totalProductionCostRs: costs.totalProductionCostRs,
  };
}

function mapSaleRow(s) {
  const weightKg = parseFloat(s.weight) || 0;
  const revenueRs = parseMoney(s.finalAmount || s.sellingPrice);
  const productionCostRs = parseMoney(s.productionCost);
  const costPerKg = parseFloat(s.costPerKg) || 0;
  const costRs =
    costPerKg > 0 && weightKg > 0
      ? costPerKg * weightKg
      : productionCostRs;
  const profitRs = revenueRs - costRs;

  return {
    _id: s._id,
    date: s.purchaseDate,
    time: s.purchaseTime || '',
    invoiceNo: s.invoiceNo,
    buyerName: s.buyerName,
    materialName: s.materialName,
    weightKg: Math.round(weightKg * 100) / 100,
    actualPriceRs: parseMoney(s.actualPrice),
    sellingPriceRs: parseMoney(s.sellingPrice),
    discountRs: parseMoney(s.discount),
    revenueRs: Math.round(revenueRs * 100) / 100,
    costRs: Math.round(costRs * 100) / 100,
    profitRs: Math.round(profitRs * 100) / 100,
    deliveryChargesRs: Math.round((parseFloat(s.transportationCost) || 0) * 100) / 100,
    amountPaidRs: parseFloat(s.amountPaid) || 0,
    remainingRs: parseFloat(s.remainingAmount) || 0,
    paymentStatus: s.paymentStatus || 'none',
    purchaseId: s.purchaseId,
    productionId: s.productionId,
  };
}

function mapExpenseRow(e) {
  const purpose = String(e.purpose || '').trim();
  const category = String(e.category || '').trim();
  return {
    _id: e._id,
    date: e.date,
    category: purpose || category || 'General',
    purpose: purpose || category || 'General',
    subject: e.subject,
    description: e.description,
    usage: e.usage,
    priceRs: parseMoney(e.price),
    personResponsible: e.personResponsible,
  };
}

function round2(v) {
  return Math.round((parseFloat(v) || 0) * 100) / 100;
}

function resolveReportRange(query) {
  const { startDate, endDate } = query || {};
  if (startDate && endDate) {
    const s = parseYmd(startDate) || startDate;
    const e = parseYmd(endDate) || endDate;
    const label = s === e ? s : `${s} — ${e}`;
    return { startDate: s, endDate: e, label };
  }
  const range = periodToRange(query);
  return { startDate: range.startDate, endDate: range.endDate, label: range.label };
}

function parseSalePricesFromQuery(query) {
  return parseSalePrices(query);
}

function groupExpensesByCategory(expenses) {
  const map = expenses.reduce((acc, e) => {
    const key = String(e.purpose || e.category || 'General').trim() || 'General';
    const existing = acc[key] || { category: key, totalRs: 0, count: 0 };
    existing.totalRs += e.priceRs;
    existing.count += 1;
    acc[key] = existing;
    return acc;
  }, {});

  return Object.values(map)
    .map((item) => ({
      category: item.category,
      totalRs: Math.round(item.totalRs * 100) / 100,
      count: item.count,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

exports.getProfitLossReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await calculateNetProfit({ startDate, endDate });

    res.json({
      success: true,
      data: {
        ...data,
        formula: 'Net Profit = Revenue − Material/Production/Wastage − Kharcha − Selling Expenses (Delivery)',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDailyMovementReport = async (req, res) => {
  try {
    const targetDate = parseYmd(req.query.date) || new Date().toISOString().split('T')[0];
    const type = req.query.type === 'raw' ? 'raw' : 'finished';
    const { start, end } = dayRange(targetDate);

    if (type === 'raw') {
      const allPurchases = await Purchase.find().lean();
      const dayPurchases = allPurchases.filter((p) => isOnDate(p.purchaseDate, targetDate));

      const allProductions = await ProductionData.find({
        productionDate: { $gte: start, $lte: end },
      }).lean();

      const purchasesKg = dayPurchases.reduce((s, p) => s + (parseFloat(p.weight) || 0), 0);
      const consumedKg = allProductions.reduce(
        (s, p) => s + (parseFloat(p.weightUsedFromPOP) || 0),
        0
      );

      const openingKg = allPurchases.reduce((s, p) => {
        const w = parseFloat(p.weight) || 0;
        const sold = parseFloat(p.soldWeight) || 0;
        const consumed = parseFloat(p.productionConsumedWeight) || 0;
        return s + Math.max(0, w - sold - consumed);
      }, 0);

      const closingKg = Math.max(0, openingKg + purchasesKg - consumedKg);

      res.json({
        success: true,
        data: {
          date: targetDate,
          type: 'raw_material',
          summary: {
            openingBalanceKg: Math.round(openingKg * 100) / 100,
            purchasesDuringPeriodKg: Math.round(purchasesKg * 100) / 100,
            productionConsumedDuringPeriodKg: Math.round(consumedKg * 100) / 100,
            closingBalanceKg: Math.round(closingKg * 100) / 100,
          },
          purchases: dayPurchases.map((p) => ({
            _id: p._id,
            receiptNo: p.receiptNo || p.invoiceNo || '—',
            vendor: p.vendor,
            materialName: p.materialName,
            weightKg: parseFloat(p.weight) || 0,
            priceRs: parseFloat(p.price) || 0,
            purchaseDate: p.purchaseDate,
          })),
          productions: allProductions.map((p) => ({
            _id: p._id,
            batchNo: p.batchNo,
            materialName: p.materialName,
            weightUsedFromPOPKg: parseFloat(p.weightUsedFromPOP) || 0,
            outputKg: parseFloat(p.totalWeight) || 0,
            wasteKg: parseFloat(p.wasteWeight) || 0,
            productionDate: p.productionDate,
          })),
        },
      });
      return;
    }

    const productions = await ProductionData.find({
      productionDate: { $gte: start, $lte: end },
    }).lean();
    const allSales = await Sale.find().lean();
    const daySales = allSales.filter((s) => isOnDate(s.purchaseDate, targetDate));

    const byProduct = {};
    productions.forEach((p) => {
      const key = p.materialName || 'Unknown';
      if (!byProduct[key]) {
        byProduct[key] = { materialName: key, openingKg: 0, productionKg: 0, salesKg: 0, closingKg: 0 };
      }
      byProduct[key].productionKg += parseFloat(p.totalWeight) || 0;
    });
    daySales.forEach((s) => {
      const key = s.materialName || 'Unknown';
      if (!byProduct[key]) {
        byProduct[key] = { materialName: key, openingKg: 0, productionKg: 0, salesKg: 0, closingKg: 0 };
      }
      byProduct[key].salesKg += parseFloat(s.weight) || 0;
    });

    const products = Object.values(byProduct).map((row) => {
      const closing = Math.max(0, row.openingKg + row.productionKg - row.salesKg);
      return {
        materialName: row.materialName,
        openingKg: row.openingKg,
        productionKg: Math.round(row.productionKg * 100) / 100,
        salesKg: Math.round(row.salesKg * 100) / 100,
        closingKg: Math.round(closing * 100) / 100,
      };
    });

    res.json({
      success: true,
      data: {
        date: targetDate,
        type: 'finished_goods',
        summary: {
          totalProductionKg: products.reduce((s, r) => s + r.productionKg, 0),
          totalSalesKg: products.reduce((s, r) => s + r.salesKg, 0),
        },
        products,
        sales: daySales.map((s) => ({
          _id: s._id,
          invoiceNo: s.invoiceNo,
          materialName: s.materialName,
          buyerName: s.buyerName,
          weightKg: parseFloat(s.weight) || 0,
          amountRs: parseFloat(s.finalAmount || s.sellingPrice) || 0,
          purchaseDate: s.purchaseDate,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Full business pipeline: POP → Process → Sales → Kharcha with daily/monthly/yearly/custom range */
exports.getBusinessPipelineReport = async (req, res) => {
  try {
    const range = periodToRange(req.query);
    const { start, end } = ymdRangeToDates(range.startDate, range.endDate);

    const [allPurchases, productions, allSales, allExpenses] = await Promise.all([
      Purchase.find().lean(),
      ProductionData.find({ productionDate: { $gte: start, $lte: end } }).lean(),
      Sale.find().lean(),
      Expense.find().lean(),
    ]);

    const purchases = allPurchases
      .filter((p) => isInYmdRange(p.purchaseDate, range.startDate, range.endDate))
      .map(mapPurchaseRow);

    const purchaseById = Object.fromEntries(allPurchases.map((p) => [String(p._id), p]));
    const productionRows = productions.map((p) =>
      mapProductionRow(p, p.purchaseId ? purchaseById[String(p.purchaseId)] : null)
    );

    const sales = allSales
      .filter((s) => isInYmdRange(s.purchaseDate, range.startDate, range.endDate))
      .map(mapSaleRow);

    const expenses = allExpenses
      .filter((e) => isInYmdRange(e.date, range.startDate, range.endDate))
      .map(mapExpenseRow);

    const expenseCategories = groupExpensesByCategory(expenses);

    const totalPurchaseWeightKg = purchases.reduce((s, p) => s + p.weightKg, 0);
    const totalPurchaseCostRs = purchases.reduce((s, p) => s + p.priceRs, 0);
    const totalProcessInputKg = productionRows.reduce((s, p) => s + p.inputKg, 0);
    const totalProcessOutputKg = productionRows.reduce((s, p) => s + p.outputKg, 0);
    const totalWasteKg = productionRows.reduce((s, p) => s + p.wasteKg, 0);
    const totalProductionCostRs = productionRows.reduce((s, p) => s + p.totalProductionCostRs, 0);
    const totalSalesWeightKg = sales.reduce((s, x) => s + x.weightKg, 0);
    const totalRevenueRs = sales.reduce((s, x) => s + x.revenueRs, 0);
    const totalSalesCostRs = sales.reduce((s, x) => s + x.costRs, 0);
    const totalSalesProfitRs = sales.reduce((s, x) => s + x.profitRs, 0);
    const totalExpensesRs = expenses.reduce((s, e) => s + e.priceRs, 0);
    const totalDeliveryChargesRs = sales.reduce((s, x) => s + (x.deliveryChargesRs || 0), 0);
    const sellingExpensesRs = Math.round(totalDeliveryChargesRs * 100) / 100;

    const grossProfit = totalRevenueRs - totalSalesCostRs;
    const netProfit = grossProfit - totalExpensesRs - sellingExpensesRs;

    res.json({
      success: true,
      data: {
        period: range.period,
        label: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        summary: {
          purchases: {
            count: purchases.length,
            totalWeightKg: Math.round(totalPurchaseWeightKg * 100) / 100,
            totalCostRs: Math.round(totalPurchaseCostRs * 100) / 100,
          },
          production: {
            count: productionRows.length,
            inputKg: Math.round(totalProcessInputKg * 100) / 100,
            outputKg: Math.round(totalProcessOutputKg * 100) / 100,
            wasteKg: Math.round(totalWasteKg * 100) / 100,
            totalCostRs: Math.round(totalProductionCostRs * 100) / 100,
          },
          sales: {
            count: sales.length,
            totalWeightKg: Math.round(totalSalesWeightKg * 100) / 100,
            revenueRs: Math.round(totalRevenueRs * 100) / 100,
            costRs: Math.round(totalSalesCostRs * 100) / 100,
            profitRs: Math.round(totalSalesProfitRs * 100) / 100,
          },
          expenses: {
            count: expenses.length,
            totalRs: Math.round(totalExpensesRs * 100) / 100,
          },
          sellingExpenses: {
            deliveryChargesRs: sellingExpensesRs,
            totalRs: sellingExpensesRs,
          },
          grossProfitRs: Math.round(grossProfit * 100) / 100,
          netProfitRs: Math.round(netProfit * 100) / 100,
          formula: 'Net Profit = Revenue − Sale Cost − Kharcha − Delivery (Selling Expenses)',
        },
        purchases,
        production: productionRows,
        sales,
        expenses,
        expenseCategories,
      },
    });
  } catch (error) {
    console.error('Business pipeline report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Profit calculation on production basis — FP Summary ledger + manual sale prices */
exports.getProfitCalculationReport = async (req, res) => {
  try {
    const range = resolveReportRange(req.query);
    const salePrices = parseSalePricesFromQuery(req.query);

    const result = await calculateProductionBasisProfit({
      startDate: range.startDate,
      endDate: range.endDate,
      salePrices,
    });

    res.json({
      success: true,
      data: {
        label: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        rows: result.rows,
        summary: {
          totalProductionKg: result.totalProductionKg,
          totalProductionCostRs: result.totalProductionCostRs,
          totalGrossProfitRs: result.totalGrossProfitRs,
          expensesRs: result.totalExpensesRs,
          netProfitRs: result.netProfitRs,
          expenseCount: result.expenseCount,
        },
        expenses: result.expenses,
        formulas: {
          grossProfitPerKg: 'Sale price per kg − Avg cost per kg',
          totalGrossProfit: 'Production in Kg × Gross profit per kg',
          netProfit: 'Total Gross Profit − All expenses',
        },
      },
    });
  } catch (error) {
    console.error('Profit calculation report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCustomerLedgerReport = async (req, res) => {
  try {
    const { customerId, startDate, endDate } = req.query;
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const customerName = customer.customerName || customer.name || '';
    const allSales = await Sale.find({
      $or: [{ customerId: customer._id }, { buyerName: customerName }],
    })
      .sort({ createdAt: 1 })
      .lean();

    let sales = allSales;
    if (startDate && endDate) {
      sales = allSales.filter((s) => {
        const ymd = parseYmd(s.purchaseDate);
        return ymd && ymd >= startDate && ymd <= endDate;
      });
    }

    const totalSales = sales.reduce(
      (s, x) => s + (parseFloat(x.finalAmount || x.sellingPrice) || 0),
      0
    );
    const totalReceived = sales.reduce((s, x) => s + (parseFloat(x.amountPaid) || 0), 0);
    const totalRemaining = sales.reduce((s, x) => s + (parseFloat(x.remainingAmount) || 0), 0);
    const openingBalance = Math.max(0, (parseFloat(customer.amount) || 0) - totalRemaining);

    res.json({
      success: true,
      data: {
        customer: customerName,
        customerPhone: customer.phoneNo || customer.phone || '',
        openingBalance: Math.round(openingBalance * 100) / 100,
        salesAdded: Math.round(totalSales * 100) / 100,
        paymentsReceived: Math.round(totalReceived * 100) / 100,
        closingBalance: Math.round(totalRemaining * 100) / 100,
        transactions: sales.map((s) => ({
          _id: s._id,
          date: s.purchaseDate,
          invoiceNo: s.invoiceNo,
          materialName: s.materialName,
          amountRs: parseFloat(s.finalAmount || s.sellingPrice) || 0,
          paidRs: parseFloat(s.amountPaid) || 0,
          remainingRs: parseFloat(s.remainingAmount) || 0,
          paymentStatus: s.paymentStatus || 'none',
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
