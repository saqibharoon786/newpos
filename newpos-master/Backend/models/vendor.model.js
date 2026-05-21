const mongoose = require('mongoose');

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
});

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    advanceBalance: { type: Number, default: 0 },
    payableBalance: { type: Number, default: 0 },
    ledger: [vendorLedgerEntrySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vendor', vendorSchema);
