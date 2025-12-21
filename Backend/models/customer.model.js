const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  customerId: {
    type: String,
    unique: true,
    trim: true
  },
  phoneNo: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  cnicNo: {
    type: String,
    trim: true,
    unique: true,
    sparse: true // Allows null values while maintaining uniqueness
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  address: {
    type: String,
    trim: true
  },
  province: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  photo: {
    type: String, // URL or base64 string
    default: null
  },
  documents: [{
    type: String // Array of URLs or base64 strings
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-generate customer ID if not provided
customerSchema.pre('save', async function(next) {
  if (!this.customerId) {
    // Generate a unique customer ID (e.g., CUST-YYYYMMDD-XXXXX)
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(10000 + Math.random() * 90000);
    this.customerId = `CUST-${dateStr}-${random}`;
  }
  
  this.updatedAt = Date.now();
  next();
});

// Indexes for better query performance
customerSchema.index({ customerName: 1 });
customerSchema.index({ phoneNo: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ cnicNo: 1 });
customerSchema.index({ isActive: 1 });

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;