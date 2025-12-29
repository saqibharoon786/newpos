const {
  RawMaterial,
  ProductSold,
  Employee,
  Asset,
  Expense,
  ActivityLog,
  DashboardSummary,
  MonthlyData
} = require('../models/dashboard.model');
const mongoose = require('mongoose');

class DashboardController {
  // Get dashboard stats
  async getDashboardStats(req, res) {
    try {
      // Get current date for filtering
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      
      // Calculate start and end of current month
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
      const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

      // 1. Total Raw Materials (only active ones)
      const totalRawMaterials = await RawMaterial.countDocuments({ isActive: true });
      
      // 2. Total Products Sold this month
      const totalProductsSold = await ProductSold.countDocuments({
        saleDate: { $gte: startOfMonth, $lte: endOfMonth },
        status: 'completed'
      });
      
      // 3. Total Active Employees
      const totalEmployees = await Employee.countDocuments({ isActive: true });
      
      // 4. Total Asset Value (sum of current values)
      const assets = await Asset.find({ status: 'active' });
      const totalAssetValue = assets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);
      
      // 5. Total Expenses this month
      const monthlyExpenses = await Expense.aggregate([
        {
          $match: {
            date: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);
      
      const totalExpenses = monthlyExpenses.length > 0 ? monthlyExpenses[0].total : 0;
      
      // 6. Total Sales this month
      const monthlySales = await ProductSold.aggregate([
        {
          $match: {
            saleDate: { $gte: startOfMonth, $lte: endOfMonth },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ['$quantity', '$price'] } }
          }
        }
      ]);
      
      const totalSales = monthlySales.length > 0 ? monthlySales[0].total : 0;
      
      // 7. Calculate profit (Sales - Expenses)
      const totalProfit = totalSales - totalExpenses;
      
      // Format numbers for display
      const formattedStats = {
        rawMaterials: {
          value: totalRawMaterials,
          formatted: totalRawMaterials.toString()
        },
        productsSold: {
          value: totalProductsSold,
          formatted: totalProductsSold.toString()
        },
        employees: {
          value: totalEmployees,
          formatted: totalEmployees.toString()
        },
        assetValue: {
          value: totalAssetValue,
          formatted: `Rs. ${totalAssetValue.toLocaleString()}`
        },
        expenses: {
          value: totalExpenses,
          formatted: `Rs. ${totalExpenses.toLocaleString()}`
        },
        sales: {
          value: totalSales,
          formatted: `Rs. ${totalSales.toLocaleString()}`
        },
        profit: {
          value: totalProfit,
          formatted: `Rs. ${totalProfit.toLocaleString()}`
        }
      };

      res.status(200).json({
        success: true,
        data: formattedStats,
        message: 'Dashboard stats retrieved successfully'
      });
      
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
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
      
      // Get data for all months of the specified year
      const monthlyData = [];
      
      for (let month = 1; month <= 12; month++) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        
        // Get sales for the month
        const salesData = await ProductSold.aggregate([
          {
            $match: {
              saleDate: { $gte: startDate, $lte: endDate },
              status: 'completed'
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $multiply: ['$quantity', '$price'] } }
            }
          }
        ]);
        
        // Get expenses for the month
        const expensesData = await Expense.aggregate([
          {
            $match: {
              date: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' }
            }
          }
        ]);
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        monthlyData.push({
          month: monthNames[month - 1],
          sales: salesData.length > 0 ? salesData[0].total : 0,
          expenses: expensesData.length > 0 ? expensesData[0].total : 0,
          profit: (salesData.length > 0 ? salesData[0].total : 0) - (expensesData.length > 0 ? expensesData[0].total : 0)
        });
      }

      res.status(200).json({
        success: true,
        data: monthlyData,
        message: 'Sales vs expenses chart data retrieved successfully'
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

  // Get recent activity
  async getRecentActivity(req, res) {
    try {
      const { limit = 10 } = req.query;
      
      // Get recent activities with populated references
      const activities = await ActivityLog.find()
        .sort({ date: -1 })
        .limit(parseInt(limit))
        .lean();
      
      // Format activities for frontend
      const formattedActivities = activities.map(activity => {
        const formatDate = (date) => {
          return new Date(date).toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        };
        
        // Map activity types to frontend categories
        const typeMapping = {
          'sale': { type: '(SALE)', color: 'text-cms-success' },
          'purchase': { type: '(PURCHASE)', color: 'text-primary' },
          'expense': { type: '(EXPENSE)', color: 'text-cms-orange' },
          'payment': { type: '(PAYMENT)', color: 'text-blue-400' },
          'delivery': { type: '(DELIVERY)', color: 'text-green-400' },
          'other': { type: '(ACTIVITY)', color: 'text-gray-400' }
        };
        
        const typeInfo = typeMapping[activity.type] || typeMapping.other;
        
        // Map icons based on activity type
        const iconMapping = {
          'sale': { icon: 'FileText', bg: 'bg-blue-500/20', color: 'text-blue-400' },
          'purchase': { icon: 'Package', bg: 'bg-green-500/20', color: 'text-green-400' },
          'expense': { icon: 'DollarSign', bg: 'bg-red-500/20', color: 'text-red-400' },
          'payment': { icon: 'CreditCard', bg: 'bg-purple-500/20', color: 'text-purple-400' },
          'delivery': { icon: 'Truck', bg: 'bg-yellow-500/20', color: 'text-yellow-400' },
          'other': { icon: 'Activity', bg: 'bg-gray-500/20', color: 'text-gray-400' }
        };
        
        const iconInfo = iconMapping[activity.type] || iconMapping.other;
        
        return {
          id: activity._id,
          icon: iconInfo.icon,
          iconBg: iconInfo.bg,
          iconColor: iconInfo.color,
          title: activity.title,
          type: typeInfo.type,
          typeColor: typeInfo.color,
          date: formatDate(activity.date),
          amount: activity.amount ? `Rs. ${activity.amount.toLocaleString()}` : 'Rs. 0'
        };
      });

      res.status(200).json({
        success: true,
        data: formattedActivities,
        message: 'Recent activities retrieved successfully'
      });
      
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching recent activities',
        error: error.message
      });
    }
  }

  // Get Roznamcha (Ledger/Register) data
  async getRoznamchaData(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date) : new Date();
      
      // Set date range for the selected day
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
      
      // Get daily sales
      const dailySales = await ProductSold.aggregate([
        {
          $match: {
            saleDate: { $gte: startOfDay, $lte: endOfDay },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $multiply: ['$quantity', '$price'] } },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Get daily expenses
      const dailyExpenses = await Expense.aggregate([
        {
          $match: {
            date: { $gte: startOfDay, $lte: endOfDay }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Get top expenses for the day
      const topExpenses = await Expense.find({
        date: { $gte: startOfDay, $lte: endOfDay }
      })
      .sort({ amount: -1 })
      .limit(5)
      .select('description amount category date')
      .lean();
      
      // Format the data
      const roznamchaData = {
        date: targetDate.toISOString().split('T')[0],
        totalSales: dailySales.length > 0 ? dailySales[0].totalAmount : 0,
        totalExpenses: dailyExpenses.length > 0 ? dailyExpenses[0].totalAmount : 0,
        salesCount: dailySales.length > 0 ? dailySales[0].count : 0,
        expensesCount: dailyExpenses.length > 0 ? dailyExpenses[0].count : 0,
        netBalance: (dailySales.length > 0 ? dailySales[0].totalAmount : 0) - 
                    (dailyExpenses.length > 0 ? dailyExpenses[0].totalAmount : 0),
        topExpenses: topExpenses.map(expense => ({
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          time: new Date(expense.date).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        }))
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
      
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      
      // Get all data for the month
      const [sales, expenses, rawMaterials, productsSold] = await Promise.all([
        ProductSold.aggregate([
          {
            $match: {
              saleDate: { $gte: startDate, $lte: endDate },
              status: 'completed'
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: { $multiply: ['$quantity', '$price'] } },
              count: { $sum: 1 }
            }
          }
        ]),
        
        Expense.aggregate([
          {
            $match: {
              date: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ]),
        
        RawMaterial.countDocuments({ isActive: true }),
        
        ProductSold.countDocuments({
          saleDate: { $gte: startDate, $lte: endDate },
          status: 'completed'
        })
      ]);
      
      const monthlySummary = {
        year: parseInt(year),
        month: parseInt(month),
        totalSales: sales.length > 0 ? sales[0].totalAmount : 0,
        totalExpenses: expenses.length > 0 ? expenses[0].totalAmount : 0,
        totalProfit: (sales.length > 0 ? sales[0].totalAmount : 0) - 
                     (expenses.length > 0 ? expenses[0].totalAmount : 0),
        salesCount: sales.length > 0 ? sales[0].count : 0,
        expensesCount: expenses.length > 0 ? expenses[0].count : 0,
        rawMaterialsCount: rawMaterials,
        productsSoldCount: productsSold
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

  // Create test data (for development)
  async createTestData(req, res) {
    try {
      // Only allow in development
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          message: 'Test data creation not allowed in production'
        });
      }

      // Clear existing test data
      await Promise.all([
        RawMaterial.deleteMany({}),
        ProductSold.deleteMany({}),
        Expense.deleteMany({}),
        ActivityLog.deleteMany({})
      ]);

      // Create raw materials
      const rawMaterials = [
        { name: 'Steel Sheets', quantity: 100, unit: 'kg', price: 500, supplier: 'Metal Corp' },
        { name: 'Plastic Pellets', quantity: 50, unit: 'kg', price: 200, supplier: 'Plastic Inc' },
        { name: 'Wood Planks', quantity: 30, unit: 'pieces', price: 800, supplier: 'Timber Ltd' },
        { name: 'Fabric Rolls', quantity: 20, unit: 'meters', price: 300, supplier: 'Textile Co' },
        { name: 'Aluminum Bars', quantity: 40, unit: 'kg', price: 700, supplier: 'Metal Corp' }
      ];
      
      await RawMaterial.insertMany(rawMaterials);

      // Create products sold (last 30 days)
      const productsSold = [];
      const today = new Date();
      
      for (let i = 0; i < 50; i++) {
        const saleDate = new Date(today);
        saleDate.setDate(today.getDate() - Math.floor(Math.random() * 30));
        saleDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
        
        productsSold.push({
          productName: `Product ${Math.floor(Math.random() * 10) + 1}`,
          quantity: Math.floor(Math.random() * 10) + 1,
          price: Math.floor(Math.random() * 10000) + 1000,
          saleDate: saleDate,
          customerName: `Customer ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
          invoiceNumber: `INV-${1000 + i}`,
          paymentMethod: ['cash', 'credit', 'bank_transfer'][Math.floor(Math.random() * 3)],
          status: 'completed'
        });
      }
      
      await ProductSold.insertMany(productsSold);

      // Create expenses (last 30 days)
      const expenses = [];
      const expenseCategories = ['salary', 'rent', 'utilities', 'fuel', 'maintenance', 'office_supplies', 'marketing'];
      
      for (let i = 0; i < 30; i++) {
        const expenseDate = new Date(today);
        expenseDate.setDate(today.getDate() - Math.floor(Math.random() * 30));
        expenseDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
        
        expenses.push({
          description: `Expense ${i + 1}`,
          amount: Math.floor(Math.random() * 10000) + 1000,
          category: expenseCategories[Math.floor(Math.random() * expenseCategories.length)],
          date: expenseDate,
          paidTo: `Vendor ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
          paymentMethod: ['cash', 'bank_transfer', 'cheque'][Math.floor(Math.random() * 3)],
          receiptNumber: `RCPT-${2000 + i}`
        });
      }
      
      await Expense.insertMany(expenses);

      // Create activity logs
      const activities = [];
      const activityTypes = ['sale', 'purchase', 'expense', 'payment', 'delivery'];
      
      for (let i = 0; i < 20; i++) {
        const activityDate = new Date(today);
        activityDate.setDate(today.getDate() - Math.floor(Math.random() * 7));
        activityDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
        
        activities.push({
          type: activityTypes[Math.floor(Math.random() * activityTypes.length)],
          title: `Activity ${i + 1}`,
          description: `Description for activity ${i + 1}`,
          amount: Math.floor(Math.random() * 50000) + 5000,
          date: activityDate,
          performedBy: `Employee ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
          status: 'completed'
        });
      }
      
      await ActivityLog.insertMany(activities);

      res.status(201).json({
        success: true,
        message: 'Test data created successfully',
        counts: {
          rawMaterials: rawMaterials.length,
          productsSold: productsSold.length,
          expenses: expenses.length,
          activities: activities.length
        }
      });
      
    } catch (error) {
      console.error('Error creating test data:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating test data',
        error: error.message
      });
    }
  }
}

module.exports = new DashboardController();