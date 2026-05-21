const mongoose = require('mongoose');
const { computePurchasePayment } = require('../utils/purchasePayment');

const purchaseSchema = new mongoose.Schema(
  {
    materialName: { type: String, required: true },
    vendor: { type: String, required: true },
    price: { type: String, required: true },
    weight: { type: String, required: true }, // Original total weight
    soldWeight: { type: Number, default: 0 }, // Total weight sold so far
    remainingWeight: { type: Number }, // Calculated: weight - soldWeight
    productionConsumedWeight: { type: Number, default: 0 }, // Weight used in Start Process (factory); remaining for processing = weight - productionConsumedWeight
    quality: { type: String, required: false },
    
    // Add status field
    status: { 
      type: String, 
      enum: ['available', 'partially_sold', 'sold_out'], 
      default: 'available' 
    },
    
    // Payment tracking
    advancePayment: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    paidAmount: { 
      type: String, 
      enum: ['none', 'partial', 'paid'], 
      default: 'none' 
    },
    remainingAmount: { type: Number, default: 0 },
    
    purchaseDate: { type: String, required: true },
    materialColor: { type: String },
    
    vehicleName: { type: String, required: false },
    vehicleType: { type: String, required: false },
    vehicleNumber: { type: String, required: false },
    driverName: { type: String, required: false },
    
    vehicleColor: { type: String, required: false },
    deliveryDate: { type: String, required: false },
    
    receiptNo: { type: String, required: false },
    vehicleImage: { type: String, required: false },
  },
  { timestamps: true }
);

// Add pre-save middleware to calculate remainingWeight (after sales and after weight sent to processing)
purchaseSchema.pre('save', function(next) {
  const originalWeight = parseFloat(this.weight) || 0;
  const soldWeight = this.soldWeight || 0;
  const productionConsumed = this.productionConsumedWeight || 0;
  this.remainingWeight = Math.max(0, originalWeight - soldWeight - productionConsumed);
  
  // Update status based on remaining weight
  if (this.remainingWeight <= 0) {
    this.status = 'sold_out';
  } else if (this.remainingWeight < originalWeight) {
    this.status = 'partially_sold';
  } else {
    this.status = 'available';
  }

  const payment = computePurchasePayment(this);
  this.totalPaid = payment.totalPaid;
  this.paidAmount = payment.paidAmount;
  this.remainingAmount = payment.remainingAmount;
  
  next();
});

// Don't forget to export the model
module.exports = mongoose.model('Purchase', purchaseSchema);