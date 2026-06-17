const mongoose = require('mongoose');

const distributionLineSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
    ownerName: { type: String, required: true },
    sharePercent: { type: Number, required: true, min: 0, max: 100 },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['drawer', 'easypaisa', 'jazzcash', 'bank'],
    },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    paidAt: { type: Date },
  },
  { _id: true }
);

const profitDistributionSchema = new mongoose.Schema(
  {
    periodYear: { type: Number, required: true },
    periodMonth: { type: Number, required: true, min: 1, max: 12 },
    periodLabel: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    totalRevenue: { type: Number, default: 0 },
    totalMaterialCost: { type: Number, default: 0 },
    grossProfit: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    reserveAmount: { type: Number, default: 0 },
    distributableProfit: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'paid'],
      default: 'draft',
    },
    lines: [distributionLineSchema],
    notes: { type: String, default: '' },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

profitDistributionSchema.index({ periodYear: 1, periodMonth: 1 }, { unique: true });

module.exports = mongoose.model('ProfitDistribution', profitDistributionSchema);
