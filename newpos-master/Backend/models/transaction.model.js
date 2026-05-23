const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['deposit', 'withdraw'],
    required: true
  },
  method: {
    type: String,
    enum: ['drawer', 'easypaisa', 'jazzcash', 'bank', 'bank_transfer', 'cheque', 'online'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  fee: {
    type: Number,
    default: 0
  },
  net: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'failed'],
    default: 'completed'
  },
  description: String,
  reference: String,
  /** vendor | customer — advance / linked payments */
  partyType: {
    type: String,
    enum: ['vendor', 'customer'],
    required: false,
  },
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  partyName: { type: String, trim: true },
  category: {
    type: String,
    enum: ['general', 'advance'],
    default: 'general',
  },
}, {
  timestamps: true
});

// Create index for faster queries
TransactionSchema.index({ date: -1 });
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ method: 1 });

// Pre-save middleware to calculate net amount
TransactionSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('fee')) {
    this.net = this.amount - this.fee;
  }
  next();
});

// Static method to get balances
TransactionSchema.statics.getBalances = async function() {
  const transactions = await this.find({});
  
  const balances = {
    drawer: 0,
    easypaisa: 0,
    jazzcash: 0,
    bank: 0
  };

  transactions.forEach(transaction => {
    let method = transaction.method;
    
    // Aggregate bank-related methods into the main 'bank' balance
    if (['bank_transfer', 'cheque', 'online'].includes(method)) {
      method = 'bank';
    }
    
    // Only update if the method is one of our tracking buckets
    if (balances.hasOwnProperty(method)) {
      if (transaction.type === 'deposit') {
        balances[method] += transaction.amount;
      } else {
        balances[method] -= transaction.amount;
      }
    }
  });

  return balances;
};

// Static method to get statistics
TransactionSchema.statics.getStats = async function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    allTransactions,
    deposits,
    withdrawals,
    recentTransactions
  ] = await Promise.all([
    this.find({}),
    this.find({ type: 'deposit' }),
    this.find({ type: 'withdraw' }),
    this.find({ 
      date: { $gte: thirtyDaysAgo } 
    })
  ]);

  const totalDeposits = deposits.reduce((sum, t) => sum + t.amount, 0);
  const totalWithdrawals = withdrawals.reduce((sum, t) => sum + t.amount, 0);
  const totalBalance = totalDeposits - totalWithdrawals;
  
  const recentDeposits = recentTransactions.filter(t => t.type === 'deposit').length;
  const recentWithdrawals = recentTransactions.filter(t => t.type === 'withdraw').length;
  
  let trend = 0;
  if (recentDeposits > 0 || recentWithdrawals > 0) {
    trend = ((recentDeposits - recentWithdrawals) / (recentDeposits + recentWithdrawals)) * 100;
  }

  return {
    totalBalance,
    totalDeposits,
    totalWithdrawals,
    depositCount: deposits.length,
    withdrawalCount: withdrawals.length,
    trend,
    transactionCount: allTransactions.length
  };
};

module.exports = mongoose.model('Transaction', TransactionSchema);