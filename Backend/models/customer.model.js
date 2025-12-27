const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerId: {
    type: String,
    unique: true,
    default: function() {
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.floor(10000 + Math.random() * 90000);
      return `CUST-${dateStr}-${random}`;
    }
  },
  phoneNo: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  cnicNo: {
    type: String,
    trim: true,
    default: ''
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  province: {
    type: String,
    trim: true,
    default: ''
  },
  city: {
    type: String,
    trim: true,
    default: ''
  },
  photo: {
    type: String,
    default: null
  },
  documents: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Create indexes for better performance
customerSchema.index({ customerName: 1 });
customerSchema.index({ phoneNo: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ customerId: 1 });
customerSchema.index({ isActive: 1 });

module.exports = mongoose.model('Customer', customerSchema);