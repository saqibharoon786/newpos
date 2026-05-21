const mongoose = require('mongoose');

const investmentAccountSchema = new mongoose.Schema(
  {
    head: { type: String, default: 'Investment', required: true },
    subHead: { type: String, required: true },
    accountName: { type: String, required: true },
    accountType: {
      type: String,
      enum: ['loan_to_owner', 'advance_to_owner', 'owner_capital', 'other'],
      default: 'other',
    },
    ownerName: { type: String, default: '' },
    balance: { type: Number, default: 0 },
    transactions: [
      {
        date: { type: Date, default: Date.now },
        type: { type: String, enum: ['debit', 'credit'] },
        amount: Number,
        description: String,
        reference: String,
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InvestmentAccount', investmentAccountSchema);
