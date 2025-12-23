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
    default: Date.now
  },
  purchaseTime: {
    type: String
  },
  status: {
    type: String,
    default: 'Active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Asset', assetSchema);