const Transaction = require('../models/transaction.model');
const Vendor = require('../models/vendor.model');
const Customer = require('../models/customer.model');

const ADVANCE_METHODS = ['drawer', 'easypaisa', 'jazzcash', 'bank'];

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
exports.getTransactions = async (req, res) => {
  try {
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
      _id: transaction._id,
      date: new Date(transaction.date).toLocaleString('en-PK'),
      type: transaction.type,
      method: transaction.method,
      fromTo: getMethodLabel(transaction.method),
      amount: transaction.amount,
      fee: transaction.fee || 0,
      net: transaction.net || transaction.amount,
      status: transaction.status || 'completed',
      description: transaction.description || '',
      reference: transaction.reference || '',
      partyType: transaction.partyType || null,
      partyId: transaction.partyId || null,
      partyName: transaction.partyName || '',
      category: transaction.category || 'general',
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
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
      error: error.message
    });
  }
};

// Get balances
exports.getBalances = async (req, res) => {
  try {
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
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching balances',
      error: error.message
    });
  }
};

// Create deposit
exports.createDeposit = async (req, res) => {
  try {
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
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating deposit',
      error: error.message
    });
  }
};

// Create withdrawal
exports.createWithdrawal = async (req, res) => {
  try {
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
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating withdrawal',
      error: error.message
    });
  }
};

// Update transaction
exports.updateTransaction = async (req, res) => {
  try {
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
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating transaction',
      error: error.message
    });
  }
};

// Delete transaction
exports.deleteTransaction = async (req, res) => {
  try {
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
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting transaction',
      error: error.message
    });
  }
};

// Export transactions
exports.exportTransactions = async (req, res) => {
  try {
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
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error exporting transactions',
      error: error.message
    });
  }
};

function isValidAdvanceMethod(method) {
  return ADVANCE_METHODS.includes(String(method || '').toLowerCase());
}

/** Vendor advance: paisa account se nikal kar vendor ko advance */
exports.recordVendorAdvance = async (req, res) => {
  try {
    const { vendorId, method, amount, description, reference } = req.body;
    const amt = parseFloat(amount);

    if (!vendorId) {
      return res.status(400).json({ success: false, message: 'Vendor select karen' });
    }
    if (!isValidAdvanceMethod(method)) {
      return res.status(400).json({
        success: false,
        message: 'Payment method: drawer, easypaisa, jazzcash ya bank',
      });
    }
    if (!amt || amt <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const balances = await Transaction.getBalances();
    const bucket = method === 'bank' ? 'bank' : method;
    if ((balances[bucket] || 0) < amt) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance in ${getMethodLabel(method)}`,
      });
    }

    const ref = reference || `VADV-${Date.now()}`;
    const desc =
      description?.trim() ||
      `Advance to vendor: ${vendor.name}`;

    const transaction = await Transaction.create({
      type: 'withdraw',
      method,
      amount: amt,
      net: amt,
      description: desc,
      reference: ref,
      status: 'completed',
      partyType: 'vendor',
      partyId: vendor._id,
      partyName: vendor.name,
      category: 'advance',
    });

    const lastBalance = vendor.ledger.length
      ? vendor.ledger[vendor.ledger.length - 1].balance
      : vendor.payableBalance - vendor.advanceBalance;
    const newBalance = lastBalance - amt;
    vendor.advanceBalance += amt;
    vendor.ledger.push({
      date: new Date(),
      type: 'advance',
      description: desc,
      credit: amt,
      debit: 0,
      balance: newBalance,
      paymentMethod: method,
      reference: ref,
      transactionId: transaction._id,
    });
    await vendor.save();

    const updatedBalances = await Transaction.getBalances();

    res.json({
      success: true,
      message: `Vendor ${vendor.name} ko Rs. ${amt.toLocaleString('en-PK')} advance diya`,
      transaction,
      vendor: {
        _id: vendor._id,
        name: vendor.name,
        advanceBalance: vendor.advanceBalance,
      },
      balances: updatedBalances,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error recording vendor advance',
      error: error.message,
    });
  }
};

/** Customer advance: customer se paisa receive — account mein deposit */
exports.recordCustomerAdvance = async (req, res) => {
  try {
    const { customerId, method, amount, description, reference } = req.body;
    const amt = parseFloat(amount);

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'Customer select karen' });
    }
    if (!isValidAdvanceMethod(method)) {
      return res.status(400).json({
        success: false,
        message: 'Payment method: drawer, easypaisa, jazzcash ya bank',
      });
    }
    if (!amt || amt <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }

    let customer = await Customer.findById(customerId);
    if (!customer) {
      customer = await Customer.findOne({ customerId: String(customerId) });
    }
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const ref = reference || `CADV-${Date.now()}`;
    const desc =
      description?.trim() ||
      `Advance from customer: ${customer.customerName}`;

    const transaction = await Transaction.create({
      type: 'deposit',
      method,
      amount: amt,
      net: amt,
      description: desc,
      reference: ref,
      status: 'completed',
      partyType: 'customer',
      partyId: customer._id,
      partyName: customer.customerName,
      category: 'advance',
    });

    customer.financeAdvanceBalance = (customer.financeAdvanceBalance || 0) + amt;
    customer.advanceLedger = customer.advanceLedger || [];
    customer.advanceLedger.push({
      date: new Date(),
      amount: amt,
      method,
      description: desc,
      reference: ref,
      transactionId: transaction._id,
    });
    await customer.save();

    const updatedBalances = await Transaction.getBalances();

    res.json({
      success: true,
      message: `Customer ${customer.customerName} se Rs. ${amt.toLocaleString('en-PK')} advance receive hua`,
      transaction,
      customer: {
        _id: customer._id,
        customerName: customer.customerName,
        financeAdvanceBalance: customer.financeAdvanceBalance,
      },
      balances: updatedBalances,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error recording customer advance',
      error: error.message,
    });
  }
};

/** Totals for vendor / customer advance summary boxes */
exports.getAdvanceSummary = async (req, res) => {
  try {
    const [vendorTxAgg, customerTxAgg, vendorBalAgg, customerBalAgg, vendorPayCount, customerPayCount] =
      await Promise.all([
        Transaction.aggregate([
          {
            $match: {
              category: 'advance',
              partyType: 'vendor',
              type: 'withdraw',
              status: 'completed',
            },
          },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Transaction.aggregate([
          {
            $match: {
              category: 'advance',
              partyType: 'customer',
              type: 'deposit',
              status: 'completed',
            },
          },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Vendor.aggregate([
          { $group: { _id: null, total: { $sum: '$advanceBalance' }, vendors: { $sum: 1 } } },
        ]),
        Customer.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: '$financeAdvanceBalance' },
              customers: { $sum: 1 },
            },
          },
        ]),
        Vendor.countDocuments({ advanceBalance: { $gt: 0 } }),
        Customer.countDocuments({ financeAdvanceBalance: { $gt: 0 } }),
      ]);

    const vendorTx = vendorTxAgg[0] || { total: 0, count: 0 };
    const customerTx = customerTxAgg[0] || { total: 0, count: 0 };
    const vendorBal = vendorBalAgg[0] || { total: 0, vendors: 0 };
    const customerBal = customerBalAgg[0] || { total: 0, customers: 0 };

    res.json({
      success: true,
      vendor: {
        totalPayments: Math.round((vendorTx.total || 0) * 100) / 100,
        paymentCount: vendorTx.count || 0,
        outstandingAdvance: Math.round((vendorBal.total || 0) * 100) / 100,
        vendorsWithAdvance: vendorPayCount,
        totalVendors: vendorBal.vendors || 0,
      },
      customer: {
        totalPayments: Math.round((customerTx.total || 0) * 100) / 100,
        paymentCount: customerTx.count || 0,
        outstandingAdvance: Math.round((customerBal.total || 0) * 100) / 100,
        customersWithAdvance: customerPayCount,
        totalCustomers: customerBal.customers || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getVendorAdvanceHistory = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const vendor = await Vendor.findById(vendorId).lean();
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const ledgerEntries = (vendor.ledger || [])
      .filter((e) => e.type === 'advance')
      .map((e) => ({
        date: e.date,
        amount: e.credit || 0,
        method: e.paymentMethod || '',
        description: e.description || '',
        reference: e.reference || '',
        source: 'ledger',
      }));

    const txns = await Transaction.find({
      partyType: 'vendor',
      partyId: vendor._id,
      category: 'advance',
    })
      .sort({ date: -1 })
      .lean();

    res.json({
      success: true,
      vendor: {
        _id: vendor._id,
        name: vendor.name,
        advanceBalance: vendor.advanceBalance || 0,
      },
      history: ledgerEntries.length > 0 ? ledgerEntries : txns.map((t) => ({
        date: t.date,
        amount: t.amount,
        method: t.method,
        description: t.description,
        reference: t.reference,
        source: 'transaction',
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getCustomerAdvanceHistory = async (req, res) => {
  try {
    const { customerId } = req.params;
    let customer = await Customer.findById(customerId).lean();
    if (!customer) {
      customer = await Customer.findOne({ customerId: String(customerId) }).lean();
    }
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const history = (customer.advanceLedger || []).map((e) => ({
      date: e.date,
      amount: e.amount,
      method: e.method,
      description: e.description,
      reference: e.reference,
    }));

    res.json({
      success: true,
      customer: {
        _id: customer._id,
        customerName: customer.customerName,
        financeAdvanceBalance: customer.financeAdvanceBalance || 0,
      },
      history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};