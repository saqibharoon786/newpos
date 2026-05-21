const Purchase = require('../models/pop.model');
const Sale = require('../models/pos.model');
const Expense = require('../models/expense.model');
const { ProductionData } = require('../models/process.model');
const Customer = require('../models/customer.model');

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

exports.getProfitLossReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const saleMatch = {};
    const purchaseMatch = {};
    const expenseMatch = {};
    if (startDate && endDate) {
      saleMatch.purchaseDate = { $gte: startDate, $lte: endDate };
      purchaseMatch.purchaseDate = { $gte: startDate, $lte: endDate };
      expenseMatch.date = { $gte: startDate, $lte: endDate };
    }

    const [salesAgg, materialCostAgg, productionCostAgg, expensesAgg] = await Promise.all([
      Sale.aggregate([
        ...(Object.keys(saleMatch).length ? [{ $match: saleMatch }] : []),
        { $group: { _id: null, total: { $sum: { $toDouble: { $ifNull: ['$finalAmount', '$sellingPrice'] } } } } },
      ]),
      Purchase.aggregate([
        ...(Object.keys(purchaseMatch).length ? [{ $match: purchaseMatch }] : []),
        { $group: { _id: null, total: { $sum: { $toDouble: '$price' } } } },
      ]),
      ProductionData.aggregate([
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalProductionCost', 0] } }, waste: { $sum: { $ifNull: ['$wasteCost', 0] } } } },
      ]),
      Expense.aggregate([
        ...(Object.keys(expenseMatch).length ? [{ $match: expenseMatch }] : []),
        { $group: { _id: null, total: { $sum: { $toDouble: '$price' } } } },
      ]),
    ]);

    const totalRevenue = salesAgg[0]?.total || 0;
    const rawMaterialCost = materialCostAgg[0]?.total || 0;
    const productionCost = productionCostAgg[0]?.total || 0;
    const wasteCost = productionCostAgg[0]?.waste || 0;
    const totalMaterialCost = rawMaterialCost + productionCost + wasteCost;
    const totalExpenses = expensesAgg[0]?.total || 0;
    const grossProfit = totalRevenue - totalMaterialCost;
    const netProfit = grossProfit - totalExpenses;

    res.json({
      success: true,
      data: {
        totalRevenue,
        rawMaterialCost,
        productionCost,
        wasteCost,
        totalMaterialCost,
        grossProfit,
        totalExpenses,
        netProfit,
        formula: 'Net Profit = Revenue − Material/Production/Wastage − Kharcha',
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

exports.getCustomerLedgerReport = async (req, res) => {
  try {
    const { customerId, startDate, endDate } = req.query;
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const allSales = await Sale.find({ buyerName: customer.name }).sort({ createdAt: 1 }).lean();

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
        customer: customer.name,
        customerPhone: customer.phone || '',
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
