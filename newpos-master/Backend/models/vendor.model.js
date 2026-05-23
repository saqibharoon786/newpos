const mongoose = require('mongoose');

const vendorMaterialSchema = new mongoose.Schema({
  productCode: { type: String, trim: true, default: '' },
  materialName: { type: String, trim: true, required: true },
  pricePerKg: { type: Number, default: 0, min: 0 },
  defaultWeight: { type: Number, default: 0, min: 0 },
});

const vendorLedgerEntrySchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  type: {
    type: String,
    enum: ['purchase', 'payment', 'advance', 'adjustment'],
    required: true,
  },
  purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
  description: { type: String },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  paymentMethod: {
    type: String,
    enum: ['drawer', 'easypaisa', 'jazzcash', 'bank'],
  },
  reference: { type: String, default: '' },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
});

const vendorSchema = new mongoose.Schema(
  {
    vendorId: {
      type: String,
      unique: true,
      default: function () {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.floor(10000 + Math.random() * 90000);
        return `VEND-${dateStr}-${random}`;
      },
    },
    name: { type: String, required: true, unique: true, trim: true },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    materials: [vendorMaterialSchema],
    advanceBalance: { type: Number, default: 0 },
    payableBalance: { type: Number, default: 0 },
    ledger: [vendorLedgerEntrySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vendor', vendorSchema);
