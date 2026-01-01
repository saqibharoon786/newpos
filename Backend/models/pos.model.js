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
      required: false, // یہ optional ہو سکتا ہے کیونکہ ممکن ہے ہر سیلز کی رسید نہ ہو
      default: "" 
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sale", saleSchema);