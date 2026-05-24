const Purchase = require('../models/pop.model');
const Sale = require('../models/pos.model');
const Expense = require('../models/expense.model');
const { ProductionData } = require('../models/process.model');

/**
 * Net profit aligned with Finance P&L:
 * Revenue − (purchases + production + waste) − expenses
 */
async function calculateNetProfit({ startDate, endDate } = {}) {
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
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: { $ifNull: ['$finalAmount', '$sellingPrice'] } } }
        }
      }
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

  return {
    totalRevenue,
    rawMaterialCost,
    productionCost,
    wasteCost,
    totalMaterialCost,
    grossProfit,
    totalExpenses,
    netProfit,
  };
}

module.exports = { calculateNetProfit };
