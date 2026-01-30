const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    materialName: { type: String, required: true },
    vendor: { type: String, required: true },
    price: { type: String, required: true },
    weight: { type: String, required: true },
    quality: { type: String, required: false },
    
    // Payment tracking
    advancePayment: { type: Number, default: 0 }, // Advance paid before purchase
    amountPaid: { type: Number, default: 0 }, // Amount paid during purchase
    totalPaid: { type: Number, default: 0 }, // advancePayment + amountPaid
    paidAmount: { // Payment status
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

module.exports = mongoose.model("Purchase", purchaseSchema);