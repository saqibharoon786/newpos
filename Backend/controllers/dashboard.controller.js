const mongoose = require('mongoose');

// Import models
const Purchase = require("../models/pop.model");
const Sale = require("../models/pos.model");
const Employee = require("../models/employee.model");
const Expense = require("../models/expense.model");
const Asset = require('../models/assets.model');

class DashboardController {
  // Get dashboard stats - WITH PROPER PROFIT CALCULATION
  async getDashboardStats(req, res) {
    try {
      console.log('====== FETCHING DASHBOARD STATS ======');

      // Run all database queries in parallel
      const [
        totalProductsCount,
        totalSalesCount,
        totalEmployeesCount,
        allAssets,
        totalSalesRevenue,
        totalPurchaseCost,
        totalExpensesAmount
      ] = await Promise.all([
        // 1. Count ALL purchases
        Purchase.countDocuments({}),
        
        // 2. Count ALL sales
        Sale.countDocuments({}),
        
        // 3. Count Active Employees
        Employee.countDocuments({ isActive: true }),
        
        // 4. Get ALL active assets for value calculation
        Asset.find({ status: 'active' }).select('currentValue value price'),
        
        // 5. Calculate total SALES REVENUE (selling price)
        Sale.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: { $toDouble: { $ifNull: ['$finalAmount', '$sellingPrice'] } } }
            }
          }
        ]),
        
        // 6. Calculate total PURCHASE COST (buying price)
        Purchase.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: { $toDouble: '$price' } }
            }
          }
        ]),
        
        // 7. Calculate total EXPENSES amount
        Expense.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: { $toDouble: '$price' } }
            }
          }
        ])
      ]);

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

      // Extract values from aggregation results
      const salesRevenue = totalSalesRevenue[0]?.total || 0;
      const purchaseCost = totalPurchaseCost[0]?.total || 0;
      const expensesAmount = totalExpensesAmount[0]?.total || 0;
      
      // CALCULATE PROFIT PROPERLY:
      // Gross Profit = Sales Revenue - Purchase Cost
      // Net Profit = Gross Profit - Expenses
      const grossProfit = salesRevenue - purchaseCost;
      const netProfit = grossProfit - expensesAmount;

      console.log('\n=== FINAL CALCULATIONS ===');
      console.log('Total Sales Revenue:', salesRevenue);
      console.log('Total Purchase Cost:', purchaseCost);
      console.log('Total Expenses:', expensesAmount);
      console.log('Gross Profit (Sales - Cost):', grossProfit);
      console.log('Net Profit (Gross - Expenses):', netProfit);
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
          title: "Purchase Cost",
          value: purchaseCost,
          formatted: `Rs. ${purchaseCost.toLocaleString()}`,
          icon: "credit-card",
          color: "blue"
        },
        expensesAmount: {
          title: "Expenses",
          value: expensesAmount,
          formatted: `Rs. ${expensesAmount.toLocaleString()}`,
          icon: "file-text",
          color: "red"
        },
        grossProfit: {
          title: "Gross Profit",
          value: grossProfit,
          formatted: `Rs. ${grossProfit.toLocaleString()}`,
          icon: "trending-up",
          color: "green",
          calculation: "Sales - Cost"
        },
        totalProfit: {
          title: "Net Profit",
          value: netProfit,
          formatted: `Rs. ${netProfit.toLocaleString()}`,
          icon: netProfit >= 0 ? "trending-up" : "trending-down",
          color: netProfit >= 0 ? "green" : "red",
          calculation: "Gross Profit - Expenses"
        },
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
          formula: "Net Profit = (Sales Revenue - Purchase Cost) - Expenses",
          example: `(${salesRevenue} - ${purchaseCost}) - ${expensesAmount} = ${netProfit}`
        },
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

      // CALCULATE PROFIT PROPERLY
      const grossProfit = salesRevenue - purchaseCost;
      const netProfit = grossProfit - expensesAmount;

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
        expensesAmount: {
          title: "Expenses",
          value: expensesAmount,
          formatted: `Rs. ${expensesAmount.toLocaleString()}`,
          icon: "file-text",
          color: "red"
        },
        grossProfit: {
          title: "Gross Profit",
          value: grossProfit,
          formatted: `Rs. ${grossProfit.toLocaleString()}`,
          icon: "trending-up",
          color: "green"
        },
        totalProfit: {
          title: "Net Profit",
          value: netProfit,
          formatted: `Rs. ${netProfit.toLocaleString()}`,
          icon: netProfit >= 0 ? "trending-up" : "trending-down",
          color: netProfit >= 0 ? "green" : "red"
        },
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
          formula: "Net Profit = (Sales Revenue - Purchase Cost) - Expenses",
          example: `(${salesRevenue} - ${purchaseCost}) - ${expensesAmount} = ${netProfit}`
        },
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