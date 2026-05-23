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
  },
  // New fields added
  amount: {
    type: Number,
    default: 0,
    min: 0
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(value) {
        return value <= this.amount;
      },
      message: 'Amount paid cannot exceed total amount'
    }
  },
  paidAmount: {
    type: String,
    enum: ['partial', 'fully', 'none'],
    default: 'none'
  },
  /** Advance received via Finance (drawer / easypaisa / jazzcash / bank) */
  financeAdvanceBalance: { type: Number, default: 0, min: 0 },
  advanceLedger: [
    {
      date: { type: Date, default: Date.now },
      amount: { type: Number, required: true, min: 0 },
      method: {
        type: String,
        enum: ['drawer', 'easypaisa', 'jazzcash', 'bank'],
        required: true,
      },
      description: { type: String, default: '' },
      reference: { type: String, default: '' },
      transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    },
  ],
}, {
  timestamps: true
});

// FIXED: Middleware to automatically update paidAmount status based on amount and amountPaid
customerSchema.pre('save', function(next) {
  // If no amount is set or amount is 0
  if (!this.amount || this.amount === 0) {
    this.paidAmount = 'none';
    this.amountPaid = 0;
  } 
  // If amountPaid is 0
  else if (!this.amountPaid || this.amountPaid === 0) {
    this.paidAmount = 'none';
  }
  // If amountPaid equals or exceeds amount
  else if (this.amountPaid >= this.amount) {
    this.paidAmount = 'fully';
    // Ensure amountPaid doesn't exceed amount
    this.amountPaid = this.amount;
  }
  // If amountPaid is greater than 0 but less than amount
  else if (this.amountPaid > 0 && this.amountPaid < this.amount) {
    this.paidAmount = 'partial';
  }
  // Default case
  else {
    this.paidAmount = 'none';
  }
  next();
});

// Virtual for pending amount
customerSchema.virtual('pendingAmount').get(function() {
  return Math.max(0, this.amount - this.amountPaid);
});

// Create indexes for better performance
customerSchema.index({ customerName: 1 });
customerSchema.index({ phoneNo: 1 });
customerSchema.index({ isActive: 1 });
customerSchema.index({ amount: 1 });
customerSchema.index({ paidAmount: 1 });
customerSchema.index({ amountPaid: 1 });

module.exports = mongoose.model('Customer', customerSchema);