const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    // Product Details
    materialName: { type: String, required: true },
    supplierName: { type: String, required: true },
    invoiceNo: { type: String, required: true },

    weight: { type: String, required: true }, // 30KG / 40KG
    unit: { type: String, required: true },

    purchaseDate: { type: String },
    purchaseTime: { type: String },

    branch: { type: String, required: false },
    materialColor: { type: String, required: true },

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
  const sellingPriceNum = parseFloat(this.sellingPrice) || 0;
  const amountPaidNum = this.amountPaid || 0;
  
  // Calculate remaining amount
  this.remainingAmount = Math.max(0, sellingPriceNum - amountPaidNum);
  
  // Determine payment status
  if (amountPaidNum === 0) {
    this.paymentStatus = 'none';
  } else if (amountPaidNum >= sellingPriceNum) {
    this.paymentStatus = 'paid';
  } else {
    this.paymentStatus = 'partial';
  }
  
  // Set finalAmount if not already set
  if (!this.finalAmount) {
    this.finalAmount = this.sellingPrice;
  }
  
  next();
});

module.exports = mongoose.model("Sale", saleSchema);