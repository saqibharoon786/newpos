const Purchase = require('../models/pop.model');
const Sale = require('../models/pos.model');
const Expense = require('../models/expense.model');
const { ProductionData } = require('../models/process.model');
const Customer = require('../models/customer.model');

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
        formula: 'Net Profit = Revenue - Material/Production/Wastage Cost - Kharcha Expenses',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDailyMovementReport = async (req, res) => {
  try {
    const { date, type = 'finished' } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    if (type === 'raw') {
      const purchases = await Purchase.find({ purchaseDate: { $regex: targetDate.slice(0, 10) } }).lean();
      const productions = await ProductionData.find({
        productionDate: {
          $gte: new Date(`${targetDate}T00:00:00`),
          $lte: new Date(`${targetDate}T23:59:59`),
        },
      }).lean();

      res.json({
        success: true,
        data: {
          date: targetDate,
          type: 'raw_material',
          openingBalance: 0,
          purchasesDuringPeriod: purchases.reduce((s, p) => s + (parseFloat(p.weight) || 0), 0),
          productionConsumedDuringPeriod: productions.reduce((s, p) => s + (p.weightUsedFromPOP || 0), 0),
          closingBalance: 0,
          details: { purchases, productions },
        },
      });
      return;
    }

    const productions = await ProductionData.find({
      productionDate: {
        $gte: new Date(`${targetDate}T00:00:00`),
        $lte: new Date(`${targetDate}T23:59:59`),
      },
    }).lean();
    const sales = await Sale.find({ purchaseDate: { $regex: targetDate.slice(0, 10) } }).lean();

    const byProduct = {};
    productions.forEach((p) => {
      const key = p.materialName || 'Unknown';
      if (!byProduct[key]) byProduct[key] = { opening: 0, production: 0, sales: 0, closing: 0 };
      byProduct[key].production += p.totalWeight || 0;
    });
    sales.forEach((s) => {
      const key = s.materialName || 'Unknown';
      if (!byProduct[key]) byProduct[key] = { opening: 0, production: 0, sales: 0, closing: 0 };
      byProduct[key].sales += parseFloat(s.weight) || 0;
    });
    Object.keys(byProduct).forEach((k) => {
      byProduct[k].closing = byProduct[k].opening + byProduct[k].production - byProduct[k].sales;
    });

    res.json({ success: true, data: { date: targetDate, type: 'finished_goods', products: byProduct } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCustomerLedgerReport = async (req, res) => {
  try {
    const { customerId, startDate, endDate } = req.query;
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const saleQuery = { buyerName: customer.name };
    if (startDate && endDate) saleQuery.purchaseDate = { $gte: startDate, $lte: endDate };

    const sales = await Sale.find(saleQuery).sort({ purchaseDate: 1 }).lean();
    const totalSales = sales.reduce((s, x) => s + (parseFloat(x.finalAmount || x.sellingPrice) || 0), 0);
    const totalReceived = sales.reduce((s, x) => s + (x.amountPaid || 0), 0);
    const openingBalance = (customer.amount || 0) - totalSales + totalReceived;

    res.json({
      success: true,
      data: {
        customer: customer.name,
        openingBalance,
        salesAdded: totalSales,
        paymentsReceived: totalReceived,
        closingBalance: openingBalance + totalSales - totalReceived,
        transactions: sales,
        totalRevenue: totalSales,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
