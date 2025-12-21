const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  assetName: {
    type: String,
    required: [true, 'Asset name is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Electronic', 'Furniture', 'Office Equipment', 'Other']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  sizeModel: {
    type: String,
    trim: true
  },
  condition: {
    type: String,
    required: [true, 'Condition is required'],
    enum: ['New', 'Good', 'Fair', 'Poor']
  },
  description: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: ['IT', 'HR', 'Finance', 'Operations', 'Other']
  },
  assignedTo: {
    type: String,
    trim: true
  },
  purchasePrice: {
    type: Number,
    min: [0, 'Purchase price cannot be negative']
  },
  purchaseFrom: {
    type: String,
    trim: true
  },
  invoiceNo: {
    type: String,
    trim: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  purchaseTime: {
    type: String
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Under Maintenance', 'Retired'],
    default: 'Active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
assetSchema.index({ assetName: 'text', description: 'text' });
assetSchema.index({ category: 1, department: 1, status: 1 });

module.exports = mongoose.model('Asset', assetSchema);