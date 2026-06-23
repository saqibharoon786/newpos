const mongoose = require('mongoose');

// Import models
const Purchase = require("../models/pop.model");
const Sale = require("../models/pos.model");
const Employee = require("../models/employee.model");
const Expense = require("../models/expense.model");
const Asset = require('../models/assets.model');
const { ProductionData } = require('../models/process.model');
const { calculateProductionBasisProfit, parseSalePrices } = require('../utils/productionBasisProfit');

function formatRs(value) {
  return `Rs. ${Number(value || 0).toLocaleString()}`;
}

function buildProductionBasisPayload(productionProfit) {
  return {
    summary: {
      totalProductionKg: productionProfit.totalProductionKg,
      totalProductionCostRs: productionProfit.totalProductionCostRs,
      totalGrossProfitRs: productionProfit.totalGrossProfitRs,
      totalExpensesRs: productionProfit.totalExpensesRs,
      netProfitRs: productionProfit.netProfitRs,
      expenseCount: productionProfit.expenseCount,
    },
    rows: productionProfit.rows,
    formulas: {
      productionCost: 'Production Kg × Avg cost per Kg',
      grossProfitPerKg: 'Sale price per kg − Avg cost per kg',
      totalGrossProfit: 'Production in Kg × Gross profit per kg',
      netProfit: 'Total Gross Profit − All expenses',
    },
  };
}

function buildProductionBasisStatCards(productionProfit) {
  const kg = productionProfit.totalProductionKg || 0;
  const productionCost = productionProfit.totalProductionCostRs || 0;
  const gross = productionProfit.totalGrossProfitRs || 0;
  const expenses = productionProfit.totalExpensesRs || 0;
  const net = productionProfit.netProfitRs || 0;

  return {
    totalProductionKg: {
      title: 'Total Production',
      value: kg,
      formatted: `${kg.toLocaleString()} kg`,
      icon: 'factory',
      color: 'blue',
    },
    totalProductionCost: {
      title: 'Production Cost',
      value: productionCost,
      formatted: formatRs(productionCost),
      icon: 'package',
      color: 'orange',
      calculation: 'Production Kg × Avg cost per Kg (FP Summary)',
    },
    grossProfit: {
      title: 'Total Gross Profit',
      value: gross,
      formatted: formatRs(gross),
      icon: 'trending-up',
      color: 'green',
      calculation: 'Production Kg × (Sale price − Avg cost)',
    },
    expensesAmount: {
      title: 'Expenses (Roznamcha)',
      value: expenses,
      formatted: formatRs(expenses),
      icon: 'file-text',
      color: 'red',
    },
    totalProfit: {
      title: 'Net Profit',
      value: net,
      formatted: formatRs(net),
      icon: net >= 0 ? 'trending-up' : 'trending-down',
      color: net >= 0 ? 'green' : 'red',
      calculation: 'Total Gross Profit − Expenses (Production Basis)',
    },
  };
}

class DashboardController {
  // Get date range for period (daily, weekly, monthly, yearly). Optional year, month for custom month.
  _getPeriodRange(period, opts = {}) {
    if (!period || period === 'all') return { startDate: null, endDate: null };
    const now = new Date();
    const year = opts.year != null ? parseInt(opts.year, 10) : now.getFullYear();
    const month = opts.month != null ? parseInt(opts.month, 10) : now.getMonth() + 1;
    let startDate, endDate;
    if (period === 'daily') {
      startDate = endDate = now.toISOString().split('T')[0];
    } else if (period === 'weekly') {
      const day = now.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      startDate = monday.toISOString().split('T')[0];
      endDate = sunday.toISOString().split('T')[0];
    } else if (period === 'monthly') {
      const y = year;
      const m = String(month).padStart(2, '0');
      startDate = `${y}-${m}-01`;
      const lastDay = new Date(y, month, 0).getDate();
      endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    } else if (period === 'yearly') {
      const y = opts.year != null ? parseInt(opts.year, 10) : now.getFullYear();
      startDate = `${y}-01-01`;
      endDate = `${y}-12-31`;
    } else {
      return { startDate: null, endDate: null };
    }
    return { startDate, endDate };
  }

  // Get dashboard stats. Optional ?period=all|daily|weekly|monthly|yearly&year=2025&month=2 (for specific month/year)
  async getDashboardStats(req, res) {
    try {
      const period = (req.query.period || 'all').toLowerCase();
      const { startDate, endDate } = this._getPeriodRange(period, {
        year: req.query.year,
        month: req.query.month,
      });
      const dateFilter = startDate && endDate ? { $gte: startDate, $lte: endDate } : null;
      const purchaseMatch = dateFilter ? { purchaseDate: dateFilter } : {};
      const saleMatch = dateFilter ? { purchaseDate: dateFilter } : {};
      const expenseMatch = dateFilter ? { date: dateFilter } : {};

      console.log('====== FETCHING DASHBOARD STATS ====== period:', period, dateFilter ? { startDate, endDate } : 'all');

      // Run all database queries in parallel (with optional date filter)
      const [
        totalProductsCount,
        totalSalesCount,
        totalEmployeesCount,
        allAssets,
        totalSalesRevenue,
        totalPurchaseCost,
        totalExpensesAmount,
        productionCostAgg,
        wasteCostAgg
      ] = await Promise.all([
        // 1. Count purchases (in period)
        Purchase.countDocuments(purchaseMatch),
        
        // 2. Count sales (in period)
        Sale.countDocuments(saleMatch),
        
        // 3. Count Active Employees (no period)
        Employee.countDocuments({ isActive: true }),
        
        // 4. Get ALL active assets for value calculation (no period)
        Asset.find({ status: 'active' }).select('currentValue value price'),
        
        // 5. Total SALES REVENUE in period
        Sale.aggregate([
          ...(Object.keys(saleMatch).length ? [{ $match: saleMatch }] : []),
          {
            $group: {
              _id: null,
              total: { $sum: { $toDouble: { $ifNull: ['$finalAmount', '$sellingPrice'] } } }
            }
          }
        ]),
        
        // 6. Total PURCHASE COST in period
        Purchase.aggregate([
          ...(Object.keys(purchaseMatch).length ? [{ $match: purchaseMatch }] : []),
          {
            $group: {
              _id: null,
              total: { $sum: { $toDouble: '$price' } }
            }
          }
        ]),
        
        // 7. Total EXPENSES in period (roznamcha)
        Expense.aggregate([
          ...(Object.keys(expenseMatch).length ? [{ $match: expenseMatch }] : []),
          {
            $group: {
              _id: null,
              total: { $sum: { $toDouble: '$price' } }
            }
          }
        ]),
        ProductionData.aggregate([
          { $group: { _id: null, total: { $sum: { $ifNull: ['$totalProductionCost', 0] } } } }
        ]),
        ProductionData.aggregate([
          { $group: { _id: null, total: { $sum: { $ifNull: ['$wasteCost', 0] } } } }
        ])
      ]);

      const salesRevenue = totalSalesRevenue[0]?.total || 0;
      const purchaseCost = totalPurchaseCost[0]?.total || 0;
      const expensesAmount = totalExpensesAmount[0]?.total || 0;
      const productionCost = productionCostAgg[0]?.total || 0;
      const wasteCost = wasteCostAgg[0]?.total || 0;
      const totalMaterialCost = purchaseCost + productionCost + wasteCost;

      console.log('\n=== DATA COUNTS ===');
      console.log('Total Products:', totalProductsCount);
      console.log('Total Sales:', totalSalesCount);
      console.log('Total Employees:', totalEmployeesCount);
      console.log('Total Assets:', allAssets.length);

      // Calculate total asset value
      let totalAssetValue = 0;
      allAssets.forEach(asset => {
        const assetValue = asset.currentValue || asset.value || asset.price || 0;
        const amount = parseFloat(assetValue.toString().replace(/[^\d.]/g, '')) || 0;
        totalAssetValue += amount;
      });

      // Profit — same formula as Reports → Profit Calculation on Production Basis
      const salePrices = parseSalePrices(req.query);
      const productionProfit = await calculateProductionBasisProfit({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        salePrices,
      });
      const productionBasisStats = buildProductionBasisStatCards(productionProfit);
      const grossProfit = productionProfit.totalGrossProfitRs;
      const netProfit = productionProfit.netProfitRs;
      const productionBasisExpenses = productionProfit.totalExpensesRs;

      console.log('\n=== FINAL CALCULATIONS ===');
      console.log('Total Sales Revenue:', salesRevenue);
      console.log('Total Purchase Cost:', purchaseCost);
      console.log('Production Cost:', productionCost);
      console.log('Waste Cost:', wasteCost);
      console.log('Total Production (Kg):', productionProfit.totalProductionKg);
      console.log('Production Cost (FP Basis):', productionProfit.totalProductionCostRs);
      console.log('Total Expenses (Production Basis):', productionBasisExpenses);
      console.log('Gross Profit (Production Basis):', grossProfit);
      console.log('Net Profit (Production Basis):', netProfit);
      console.log('Total Assets Value:', totalAssetValue);

      // FIXED RESPONSE - WITH PROPER PROFIT CALCULATION
      const dashboardStats = {
        totalProducts: {
          title: "Total Products",
          value: totalProductsCount,
          formatted: totalProductsCount.toString(),
          icon: "package",
          color: "blue"
        },
        totalSales: {
          title: "Total Sales",
          value: totalSalesCount,
          formatted: totalSalesCount.toString(),
          icon: "shopping-bag",
          color: "green"
        },
        totalPurchases: {
          title: "Total Purchases",
          value: totalProductsCount, // Same as products count
          formatted: totalProductsCount.toString(),
          icon: "shopping-cart",
          color: "blue"
        },
        totalExpenses: {
          title: "Total Expenses",
          value: expensesAmount,
          formatted: `Rs. ${expensesAmount.toLocaleString()}`,
          icon: "trending-down",
          color: "red"
        },
        totalEmployees: {
          title: "Total Employees",
          value: totalEmployeesCount,
          formatted: totalEmployeesCount.toString(),
          icon: "users",
          color: "purple"
        },
        totalAssets: {
          title: "Total Assets",
          value: allAssets.length,
          formatted: allAssets.length.toString(),
          icon: "home",
          color: "orange"
        },
        salesRevenue: {
          title: "Sales Revenue",
          value: salesRevenue,
          formatted: `Rs. ${salesRevenue.toLocaleString()}`,
          icon: "dollar-sign",
          color: "green"
        },
        purchaseCost: {
          title: "Material Cost",
          value: totalMaterialCost,
          formatted: `Rs. ${totalMaterialCost.toLocaleString()}`,
          icon: "credit-card",
          color: "blue"
        },
        productionCost: {
          title: "Production Cost",
          value: productionCost,
          formatted: `Rs. ${productionCost.toLocaleString()}`,
          icon: "package",
          color: "orange"
        },
        wasteCost: {
          title: "Wastage Cost",
          value: wasteCost,
          formatted: `Rs. ${wasteCost.toLocaleString()}`,
          icon: "trending-down",
          color: "red"
        },
        expensesAmount: productionBasisStats.expensesAmount,
        grossProfit: productionBasisStats.grossProfit,
        totalProfit: productionBasisStats.totalProfit,
        totalProductionKg: productionBasisStats.totalProductionKg,
        totalProductionCost: productionBasisStats.totalProductionCost,
        assetsValue: {
          title: "Assets Value",
          value: totalAssetValue,
          formatted: `Rs. ${totalAssetValue.toLocaleString()}`,
          icon: "briefcase",
          color: "orange"
        }
      };

      const periodLabels = { all: 'All Time', daily: 'Today', weekly: 'This Week', monthly: 'This Month', yearly: 'This Year' };
      let periodLabel = periodLabels[period] || periodLabels.all;
      if (period === 'monthly' && req.query.year && req.query.month) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const m = parseInt(req.query.month, 10);
        if (m >= 1 && m <= 12) {
          periodLabel = `${monthNames[m - 1]} ${req.query.year}`;
        }
      } else if (period === 'yearly' && req.query.year) {
        periodLabel = `Year ${req.query.year}`;
      }
      res.status(200).json({
        success: true,
        data: dashboardStats,
        period: period,
        periodLabel: periodLabel,
        dateRange: startDate && endDate ? { startDate, endDate } : null,
        calculation: {
          formula: "Net Profit = Total Gross Profit (Production Basis) − Expenses",
          example: `${grossProfit} − ${productionBasisExpenses} = ${netProfit}`,
          basis: "production",
        },
        productionBasis: buildProductionBasisPayload(productionProfit),
        message: 'Dashboard stats retrieved successfully'
      });
      
    } catch (error) {
      console.error('====== ERROR in getDashboardStats ======');
      console.error('Error:', error.message);
      
      // Fallback to simpler calculation if aggregation fails
      console.log('Falling back to simpler calculation...');
      return this.getDashboardStatsFallback(req, res);
    }
  }

  // Fallback method if aggregation fails
  async getDashboardStatsFallback(req, res) {
    try {
      console.log('Using fallback calculation method...');
      
      const [
        allPurchases,
        allSales,
        allExpenses,
        totalEmployeesCount,
        allAssets
      ] = await Promise.all([
        Purchase.find({}).select('price'),
        Sale.find({}).select('sellingPrice finalAmount'),
        Expense.find({}).select('price'),
        Employee.countDocuments({ isActive: true }),
        Asset.find({ status: 'active' }).select('currentValue value price')
      ]);

      // Calculate totals manually
      let totalAssetValue = 0;
      allAssets.forEach(asset => {
        const assetValue = asset.currentValue || asset.value || asset.price || 0;
        const amount = parseFloat(assetValue.toString().replace(/[^\d.]/g, '')) || 0;
        totalAssetValue += amount;
      });

      let salesRevenue = 0;
      allSales.forEach(sale => {
        const saleValue = sale.finalAmount || sale.sellingPrice;
        if (saleValue) {
          const saleAmount = parseFloat(saleValue.toString().replace(/[^\d.]/g, '')) || 0;
          salesRevenue += saleAmount;
        }
      });

      let purchaseCost = 0;
      allPurchases.forEach(purchase => {
        if (purchase.price) {
          const costAmount = parseFloat(purchase.price.toString().replace(/[^\d.]/g, '')) || 0;
          purchaseCost += costAmount;
        }
      });

      let expensesAmount = 0;
      allExpenses.forEach(expense => {
        if (expense.price) {
          const expenseAmount = parseFloat(expense.price.toString().replace(/[^\d.]/g, '')) || 0;
          expensesAmount += expenseAmount;
        }
      });

      const period = (req.query.period || 'all').toLowerCase();
      const { startDate, endDate } = this._getPeriodRange(period, {
        year: req.query.year,
        month: req.query.month,
      });
      const salePrices = parseSalePrices(req.query);
      const productionProfit = await calculateProductionBasisProfit({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        salePrices,
      });
      const productionBasisStats = buildProductionBasisStatCards(productionProfit);
      const grossProfit = productionProfit.totalGrossProfitRs;
      const netProfit = productionProfit.netProfitRs;
      const productionBasisExpenses = productionProfit.totalExpensesRs;

      const dashboardStats = {
        totalProducts: {
          title: "Total Products",
          value: allPurchases.length,
          formatted: allPurchases.length.toString(),
          icon: "package",
          color: "blue"
        },
        totalSales: {
          title: "Total Sales",
          value: allSales.length,
          formatted: allSales.length.toString(),
          icon: "shopping-bag",
          color: "green"
        },
        totalExpenses: {
          title: "Total Expenses",
          value: expensesAmount,
          formatted: `Rs. ${expensesAmount.toLocaleString()}`,
          icon: "trending-down",
          color: "red"
        },
        totalEmployees: {
          title: "Total Employees",
          value: totalEmployeesCount,
          formatted: totalEmployeesCount.toString(),
          icon: "users",
          color: "purple"
        },
        totalAssets: {
          title: "Total Assets",
          value: allAssets.length,
          formatted: allAssets.length.toString(),
          icon: "home",
          color: "orange"
        },
        salesRevenue: {
          title: "Sales Revenue",
          value: salesRevenue,
          formatted: `Rs. ${salesRevenue.toLocaleString()}`,
          icon: "dollar-sign",
          color: "green"
        },
        purchaseCost: {
          title: "Purchase Cost",
          value: purchaseCost,
          formatted: `Rs. ${purchaseCost.toLocaleString()}`,
          icon: "credit-card",
          color: "blue"
        },
        expensesAmount: productionBasisStats.expensesAmount,
        grossProfit: productionBasisStats.grossProfit,
        totalProfit: productionBasisStats.totalProfit,
        totalProductionKg: productionBasisStats.totalProductionKg,
        totalProductionCost: productionBasisStats.totalProductionCost,
        assetsValue: {
          title: "Assets Value",
          value: totalAssetValue,
          formatted: `Rs. ${totalAssetValue.toLocaleString()}`,
          icon: "briefcase",
          color: "orange"
        }
      };

      res.status(200).json({
        success: true,
        data: dashboardStats,
        calculation: {
          formula: "Net Profit = Total Gross Profit (Production Basis) − Expenses",
          example: `${grossProfit} − ${productionBasisExpenses} = ${netProfit}`,
          basis: "production",
        },
        productionBasis: buildProductionBasisPayload(productionProfit),
        message: 'Dashboard stats retrieved successfully (fallback method)'
      });
      
    } catch (error) {
      console.error('Error in fallback method:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching dashboard statistics',
        error: error.message
      });
    }
  }

  // Get sales vs expenses chart data
  async getSalesExpensesChart(req, res) {
    try {
      const { year = new Date().getFullYear() } = req.query;
      
      const monthlyData = [];
      
      for (let month = 1; month <= 12; month++) {
        const monthStr = month.toString().padStart(2, '0');
        const startDateStr = `${year}-${monthStr}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDateStr = `${year}-${monthStr}-${lastDay.toString().padStart(2, '0')}`;
        
        const [sales, expenses, purchases] = await Promise.all([
          Sale.find({
            purchaseDate: { 
              $gte: startDateStr, 
              $lte: endDateStr 
            }
          }).select('sellingPrice finalAmount'),
          
          Expense.find({
            date: { 
              $gte: startDateStr, 
              $lte: endDateStr 
            }
          }).select('price'),
          
          Purchase.find({
            purchaseDate: { 
              $gte: startDateStr, 
              $lte: endDateStr 
            }
          }).select('price')
        ]);
        
        let totalSales = 0;
        sales.forEach(sale => {
          const saleValue = sale.finalAmount || sale.sellingPrice;
          if (saleValue) {
            totalSales += parseFloat(saleValue.toString().replace(/[^\d.]/g, '')) || 0;
          }
        });
        
        let totalExpenses = 0;
        expenses.forEach(expense => {
          if (expense.price) {
            totalExpenses += parseFloat(expense.price.toString().replace(/[^\d.]/g, '')) || 0;
          }
        });
        
        let totalPurchases = 0;
        purchases.forEach(purchase => {
          if (purchase.price) {
            totalPurchases += parseFloat(purchase.price.toString().replace(/[^\d.]/g, '')) || 0;
          }
        });
        
        const grossProfit = totalSales - totalPurchases;
        const netProfit = grossProfit - totalExpenses;
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        monthlyData.push({
          month: monthNames[month - 1],
          sales: totalSales,
          purchases: totalPurchases,
          expenses: totalExpenses,
          grossProfit: grossProfit,
          netProfit: netProfit
        });
      }

      res.status(200).json({
        success: true,
        data: monthlyData,
        message: 'Chart data retrieved successfully'
      });
      
    } catch (error) {
      console.error('Error fetching chart data:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching chart data',
        error: error.message
      });
    }
  }

  // Get Roznamcha (Daily Ledger)
  async getRoznamchaData(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date) : new Date();
      
      const dateStr = targetDate.toISOString().split('T')[0];
      
      const [sales, expenses] = await Promise.all([
        Sale.find({ purchaseDate: dateStr }).select('sellingPrice finalAmount buyerName materialName purchaseTime'),
        Expense.find({ date: dateStr }).select('price subject description time')
      ]);
      
      let totalSales = 0;
      const salesDetails = sales.map(sale => {
        const saleValue = sale.finalAmount || sale.sellingPrice;
        const saleAmount = saleValue ? parseFloat(saleValue.toString().replace(/[^\d.]/g, '')) || 0 : 0;
        totalSales += saleAmount;
        
        return {
          customer: sale.buyerName,
          product: sale.materialName,
          amount: saleAmount,
          time: sale.purchaseTime || 'N/A'
        };
      });
      
      let totalExpenses = 0;
      const expensesDetails = expenses.map(expense => {
        const expenseAmount = expense.price ? parseFloat(expense.price.toString().replace(/[^\d.]/g, '')) || 0 : 0;
        totalExpenses += expenseAmount;
        
        return {
          subject: expense.subject,
          description: expense.description,
          amount: expenseAmount,
          time: expense.time || 'N/A'
        };
      });
      
      const roznamchaData = {
        date: dateStr,
        totalSales: totalSales,
        totalExpenses: totalExpenses,
        netBalance: totalSales - totalExpenses,
        salesCount: sales.length,
        expensesCount: expenses.length,
        salesDetails: salesDetails,
        expensesDetails: expensesDetails
      };

      res.status(200).json({
        success: true,
        data: roznamchaData,
        message: 'Roznamcha data retrieved successfully'
      });
      
    } catch (error) {
      console.error('Error fetching roznamcha data:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching roznamcha data',
        error: error.message
      });
    }
  }

  // Get monthly summary
  async getMonthlySummary(req, res) {
    try {
      const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
      
      const monthStr = month.toString().padStart(2, '0');
      const startDateStr = `${year}-${monthStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDateStr = `${year}-${monthStr}-${lastDay.toString().padStart(2, '0')}`;
      
      const [sales, expenses, purchases] = await Promise.all([
        Sale.find({ purchaseDate: { $gte: startDateStr, $lte: endDateStr } }).select('sellingPrice finalAmount'),
        Expense.find({ date: { $gte: startDateStr, $lte: endDateStr } }).select('price'),
        Purchase.find({ purchaseDate: { $gte: startDateStr, $lte: endDateStr } })
      ]);
      
      // Calculate amounts
      let salesAmount = 0;
      sales.forEach(sale => {
        const saleValue = sale.finalAmount || sale.sellingPrice;
        if (saleValue) {
          salesAmount += parseFloat(saleValue.toString().replace(/[^\d.]/g, '')) || 0;
        }
      });
      
      let expensesAmount = 0;
      expenses.forEach(expense => {
        if (expense.price) {
          expensesAmount += parseFloat(expense.price.toString().replace(/[^\d.]/g, '')) || 0;
        }
      });
      
      const profit = salesAmount - expensesAmount;
      
      const monthlySummary = {
        year: parseInt(year),
        month: parseInt(month),
        monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
        totalSalesCount: sales.length,
        totalExpensesCount: expenses.length,
        totalPurchasesCount: purchases.length,
        salesAmount: salesAmount,
        expensesAmount: expensesAmount,
        profit: profit
      };

      res.status(200).json({
        success: true,
        data: monthlySummary,
        message: 'Monthly summary retrieved successfully'
      });
      
    } catch (error) {
      console.error('Error fetching monthly summary:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching monthly summary',
        error: error.message
      });
    }
  }
}

module.exports = new DashboardController();