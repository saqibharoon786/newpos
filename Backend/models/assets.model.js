const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  assetName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  sizeModel: {
    type: String
  },
  condition: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  department: {
    type: String,
    required: true
  },
  assignedTo: {
    type: String
  },
  purchasePrice: {
    type: Number
  },
  purchaseFrom: {
    type: String
  },
  invoiceNo: {
    type: String
  },
  purchaseDate: {
    type: Date,
  },
  purchaseTime: {
    type: String
  },
  status: {
    type: String,
    default: 'Active'
  },
  receiptImage: {
    type: String, // This will store the image URL or Base64 string
    default: null
  }
}, {
  timestamps: true
});

// Create indexes for better performance
assetSchema.index({ assetName: 1 });
assetSchema.index({ category: 1 });
assetSchema.index({ department: 1 });
assetSchema.index({ status: 1 });
assetSchema.index({ assignedTo: 1 });

module.exports = mongoose.model('Asset', assetSchema);