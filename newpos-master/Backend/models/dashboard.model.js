const mongoose = require('mongoose');

// Dashboard-specific schemas with unique names

// 1. Dashboard Raw Material Schema
const dashboardRawMaterialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  unit: {
    type: String,
    required: true,
    default: 'kg'
  },
  price: {
    type: Number,
    required: true
  },
  supplier: {
    type: String,
    trim: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  category: {
    type: String,
    enum: ['steel', 'plastic', 'wood', 'fabric', 'other'],
    default: 'other'
  },
  warehouseLocation: {
    type: String,
    trim: true
  },
  minStockLevel: {
    type: Number,
    default: 10
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'dashboard_raw_materials' // Unique collection name
});

// 2. Dashboard Product Sold Schema
const dashboardProductSoldSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  saleDate: {
    type: Date,
    required: true
  },
  customerName: {
    type: String,
    trim: true
  },
  invoiceNumber: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit', 'bank_transfer', 'online'],
    default: 'cash'
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'cancelled'],
    default: 'completed'
  }
}, {
  timestamps: true,
  collection: 'dashboard_products_sold'
});

// 3. Dashboard Employee Schema
const dashboardEmployeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  employeeId: {
    type: String,
    required: true,
    unique: true
  },
  department: {
    type: String,
    required: true,
    enum: ['production', 'sales', 'admin', 'logistics', 'management']
  },
  position: {
    type: String,
    required: true
  },
  salary: {
    type: Number,
    required: true
  },
  joiningDate: {
    type: Date,
    required: true
  },
  contactNumber: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'dashboard_employees'
});

// 4. Dashboard Asset Schema (with unique name)
const dashboardAssetSchema = new mongoose.Schema({
  assetName: {
    type: String,
    required: true,
    trim: true
  },
  assetType: {
    type: String,
    enum: ['vehicle', 'machinery', 'equipment', 'furniture', 'property'],
    required: true
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  purchasePrice: {
    type: Number,
    required: true
  },
  currentValue: {
    type: Number,
    required: true
  },
  depreciationRate: {
    type: Number,
    default: 0
  },
  location: {
    type: String,
    trim: true
  },
  assignedTo: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'maintenance', 'disposed', 'lost'],
    default: 'active'
  }
}, {
  timestamps: true,
  collection: 'dashboard_assets' // Unique collection name
});

// 5. Dashboard Expense Schema
const dashboardExpenseSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['salary', 'rent', 'utilities', 'fuel', 'maintenance', 'office_supplies', 'marketing', 'other'],
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  paidTo: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'cheque', 'online'],
    default: 'cash'
  },
  receiptNumber: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  collection: 'dashboard_expenses'
});

// 6. Monthly Sales & Expenses Schema
const dashboardMonthlyDataSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  totalSales: {
    type: Number,
    default: 0
  },
  totalExpenses: {
    type: Number,
    default: 0
  },
  totalProfit: {
    type: Number,
    default: 0
  },
  salesData: [{
    date: Date,
    amount: Number,
    category: String
  }],
  expenseData: [{
    date: Date,
    amount: Number,
    category: String
  }]
}, {
  timestamps: true,
  collection: 'dashboard_monthly_data'
});

// 7. Dashboard Activity Log Schema
const dashboardActivityLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['sale', 'purchase', 'expense', 'payment', 'delivery', 'other'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  amount: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  referenceType: {
    type: String
  },
  performedBy: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'cancelled'],
    default: 'completed'
  }
}, {
  timestamps: true,
  collection: 'dashboard_activity_logs'
});

// 8. Dashboard Summary Schema
const dashboardSummarySchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
    unique: true
  },
  totalRawMaterials: {
    type: Number,
    default: 0
  },
  totalProductsSold: {
    type: Number,
    default: 0
  },
  totalEmployees: {
    type: Number,
    default: 0
  },
  totalAssetValue: {
    type: Number,
    default: 0
  },
  totalExpenses: {
    type: Number,
    default: 0
  },
  totalSales: {
    type: Number,
    default: 0
  },
  totalProfit: {
    type: Number,
    default: 0
  },
  monthlyData: [dashboardMonthlyDataSchema]
}, {
  timestamps: true,
  collection: 'dashboard_summaries'
});

// Create models with unique names
const DashboardRawMaterial = mongoose.model('DashboardRawMaterial', dashboardRawMaterialSchema);
const DashboardProductSold = mongoose.model('DashboardProductSold', dashboardProductSoldSchema);
const DashboardEmployee = mongoose.model('DashboardEmployee', dashboardEmployeeSchema);
const DashboardAsset = mongoose.model('DashboardAsset', dashboardAssetSchema);
const DashboardExpense = mongoose.model('DashboardExpense', dashboardExpenseSchema);
const DashboardActivityLog = mongoose.model('DashboardActivityLog', dashboardActivityLogSchema);
const DashboardSummary = mongoose.model('DashboardSummary', dashboardSummarySchema);
const DashboardMonthlyData = mongoose.model('DashboardMonthlyData', dashboardMonthlyDataSchema);

module.exports = {
  DashboardRawMaterial,
  DashboardProductSold,
  DashboardEmployee,
  DashboardAsset,
  DashboardExpense,
  DashboardActivityLog,
  DashboardSummary,
  DashboardMonthlyData
};