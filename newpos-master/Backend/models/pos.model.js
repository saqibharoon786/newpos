const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    // Product Details
    materialName: { type: String, required: true },
    supplierName: { type: String, required: true },
    invoiceNo: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    paymentMethod: {
      type: String,
      enum: ['cash', 'credit', 'advance', 'bank', 'easypaisa', 'jazzcash', 'drawer'],
      default: 'cash',
    },
    approvalStatus: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      default: 'pending',
    },
    costPerKg: { type: Number, default: 0 },

    weight: { type: String, required: true }, // 30KG / 40KG
    unit: { type: String, required: true },

    purchaseDate: { type: String },
    purchaseTime: { type: String },

    branch: { type: String, required: false },
    quality: { type: String, required: false },
    materialColor: { type: String, required: true },

    // Source: either purchase (POP) or production
    purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", required: false },
    productionId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionData", required: false },

    // Price Details
    actualPrice: { type: String, required: true },
    productionCost: { type: String, required: true },
    sellingPrice: { type: String, required: true },
    discount: { type: String, default: "0" },
    finalAmount: { type: String },
    advancePayment: { type: Number, default: 0 }, // ADDED THIS FIELD

    // Payment Tracking Fields
    amountPaid: { 
      type: Number, 
      default: 0,
      required: true 
    },
    remainingAmount: { 
      type: Number, 
      default: 0,
      required: true 
    },
    paymentStatus: { 
      type: String, 
      enum: ['none', 'partial', 'paid'], 
      default: 'none',
      required: true 
    },

    // Buyer Details
    buyerName: { type: String, required: true },
    buyerAddress: { type: String, required: false },
    buyerPhone: { type: String, required: false },
    buyerEmail: { type: String, required: false },
    buyerCnic: { type: String, required: false },
    buyerCompany: { type: String, required: false },

    // New field for receipt image
    receiptImage: { 
      type: String, 
      required: false,
      default: "" 
    },
  },
  { timestamps: true }
);

// Pre-save middleware to automatically calculate remaining amount and payment status
saleSchema.pre('save', function(next) {
  const billTotal = parseFloat(this.finalAmount) || parseFloat(this.sellingPrice) || 0;
  const amountPaidNum = this.amountPaid || 0;

  this.remainingAmount = Math.max(0, billTotal - amountPaidNum);

  if (amountPaidNum === 0) {
    this.paymentStatus = 'none';
  } else if (amountPaidNum >= billTotal) {
    this.paymentStatus = 'paid';
  } else {
    this.paymentStatus = 'partial';
  }

  if (!this.finalAmount) {
    this.finalAmount = this.sellingPrice;
  }

  next();
});

module.exports = mongoose.model("Sale", saleSchema);