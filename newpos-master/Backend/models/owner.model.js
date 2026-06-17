const mongoose = require('mongoose');

const ownerSchema = new mongoose.Schema(
  {
    ownerCode: {
      type: String,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
    },
    phone: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    cnic: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    /** Profit share % — all active owners should total 100 */
    profitSharePercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    investmentAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InvestmentAccount',
    },
    totalProfitReceived: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ownerSchema.index({ name: 'text', ownerCode: 'text' });
ownerSchema.index({ isActive: 1 });

ownerSchema.pre('save', async function (next) {
  if (!this.ownerCode) {
    const count = await this.constructor.countDocuments();
    this.ownerCode = `OWR${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Owner', ownerSchema);
