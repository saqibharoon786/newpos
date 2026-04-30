const Transaction = require('../models/transaction.model');
const { asyncHandler } = require("../utils/asyncHandler");

// Format currency helper
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
  }).format(amount);
};

// Get method label
const getMethodLabel = (method) => {
  const labels = {
    drawer: 'Cash Drawer',
    easypaisa: 'Easypaisa',
    jazzcash: 'JazzCash',
    bank: 'Bank Account',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
    online: 'Online Payment'
  };
  return labels[method] || method;
};

// Get all transactions with filters
exports.getTransactions = asyncHandler(async (req, res) => {
  const { search, type, method, startDate, endDate, page = 1, limit = 10 } = req.query;
  
  const query = {};
  
  // Apply filters
  if (type && type !== 'all') {
    query.type = type;
  }
  
  if (method && method !== 'all') {
    query.method = method;
  }
  
  // Date range filter
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }
  
  // Search filter
  if (search) {
    query.$or = [
      { description: { $regex: search, $options: 'i' } },
      { reference: { $regex: search, $options: 'i' } }
    ];
  }
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Transaction.countDocuments(query)
  ]);
  
  // Format transactions for frontend
  const formattedTransactions = transactions.map(transaction => ({
    id: transaction._id,
    date: new Date(transaction.date).toLocaleString('en-PK'),
    type: transaction.type,
    fromTo: getMethodLabel(transaction.method),
    amount: transaction.amount,
    fee: transaction.fee || 0,
    net: transaction.net || transaction.amount,
    status: transaction.status || 'completed',
    description: transaction.description || '',
    reference: transaction.reference || ''
  }));
  
  res.json({
    success: true,
    transactions: formattedTransactions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// Get balances
exports.getBalances = asyncHandler(async (req, res) => {
  const balances = await Transaction.getBalances();
  const stats = await Transaction.getStats();
  
  res.json({
    success: true,
    balances,
    stats: {
      ...stats,
      formattedTotalBalance: formatCurrency(stats.totalBalance),
      formattedTotalDeposits: formatCurrency(stats.totalDeposits),
      formattedTotalWithdrawals: formatCurrency(stats.totalWithdrawals)
    }
  });
});

// Create deposit
exports.createDeposit = asyncHandler(async (req, res) => {
  const { method, amount, description, reference } = req.body;
  
  if (!method || !amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid method and amount are required'
    });
  }
  
  const transaction = await Transaction.create({
    type: 'deposit',
    method,
    amount: parseFloat(amount),
    net: parseFloat(amount),
    description: description || 'Deposit',
    reference: reference || `DEP-${Date.now()}`,
    status: 'completed'
  });
  
  // Get updated balances
  const balances = await Transaction.getBalances();
  
  res.json({
    success: true,
    message: `Deposited ${formatCurrency(amount)} successfully`,
    transaction: {
      id: transaction._id,
      date: new Date(transaction.date).toLocaleString('en-PK'),
      type: transaction.type,
      fromTo: getMethodLabel(transaction.method),
      amount: transaction.amount,
      net: transaction.net,
      status: transaction.status,
      description: transaction.description
    },
    balances
  });
});

// Create withdrawal
exports.createWithdrawal = asyncHandler(async (req, res) => {
  const { method, amount, description, reference } = req.body;
  
  if (!method || !amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid method and amount are required'
    });
  }
  
  // Check if sufficient balance
  const balances = await Transaction.getBalances();
  if ((balances[method] || 0) < parseFloat(amount)) {
    return res.status(400).json({
      success: false,
      message: 'Insufficient balance!'
    });
  }
  
  const transaction = await Transaction.create({
    type: 'withdraw',
    method,
    amount: parseFloat(amount),
    net: parseFloat(amount),
    description: description || 'Withdrawal',
    reference: reference || `WD-${Date.now()}`,
    status: 'completed'
  });
  
  // Get updated balances
  const updatedBalances = await Transaction.getBalances();
  
  res.json({
    success: true,
    message: `Withdrew ${formatCurrency(amount)} successfully`,
    transaction: {
      id: transaction._id,
      date: new Date(transaction.date).toLocaleString('en-PK'),
      type: transaction.type,
      fromTo: getMethodLabel(transaction.method),
      amount: transaction.amount,
      net: transaction.net,
      status: transaction.status,
      description: transaction.description
    },
    balances: updatedBalances
  });
});

// Update transaction
exports.updateTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  
  const transaction = await Transaction.findById(id);
  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found'
    });
  }
  
  // Remove immutable fields
  delete updateData.type;
  delete updateData.method;
  delete updateData.date;
  
  const updatedTransaction = await Transaction.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );
  
  // Get updated balances
  const balances = await Transaction.getBalances();
  
  res.json({
    success: true,
    message: 'Transaction updated successfully',
    transaction: {
      id: updatedTransaction._id,
      date: new Date(updatedTransaction.date).toLocaleString('en-PK'),
      type: updatedTransaction.type,
      fromTo: getMethodLabel(updatedTransaction.method),
      amount: updatedTransaction.amount,
      net: updatedTransaction.net,
      status: updatedTransaction.status,
      description: updatedTransaction.description
    },
    balances
  });
});

// Delete transaction
exports.deleteTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const transaction = await Transaction.findById(id);
  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found'
    });
  }
  
  await Transaction.findByIdAndDelete(id);
  
  // Get updated balances
  const balances = await Transaction.getBalances();
  
  res.json({
    success: true,
    message: 'Transaction deleted successfully',
    balances
  });
});

// Export transactions
exports.exportTransactions = asyncHandler(async (req, res) => {
  const { format = 'csv', startDate, endDate } = req.query;
  
  const query = {};
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }
  
  const transactions = await Transaction.find(query)
    .sort({ date: -1 })
    .lean();
  
  if (transactions.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No transactions found'
    });
  }
  
  if (format === 'csv') {
    // Convert to CSV
    const csv = [
      ['Date', 'Type', 'Method', 'Amount', 'Fee', 'Net', 'Description', 'Status'],
      ...transactions.map(t => [
        new Date(t.date).toLocaleString('en-PK'),
        t.type,
        getMethodLabel(t.method),
        t.amount,
        t.fee || 0,
        t.net || t.amount,
        t.description || '',
        t.status
      ])
    ].map(row => row.join(',')).join('\n');
    
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename=transactions_${Date.now()}.csv`);
    res.send(csv);
  } else {
    // JSON format
    res.json({
      success: true,
      transactions: transactions.map(t => ({
        date: new Date(t.date).toLocaleString('en-PK'),
        type: t.type,
        method: getMethodLabel(t.method),
        amount: t.amount,
        fee: t.fee || 0,
        net: t.net || t.amount,
        description: t.description || '',
        status: t.status
      }))
    });
  }
});