const Transaction = require('../models/transaction.model');
const Vendor = require('../models/vendor.model');
const Customer = require('../models/customer.model');
const vendorController = require('./vendor.controller');
const {
  getGlobalPartyTotals,
  getVendorLinkedProfile,
  getCustomerLinkedProfile,
} = require('../utils/financePartyLink');
const {
  deletePartyAdvanceTransaction,
  deleteCustomerAdvanceEntry,
} = require('../utils/financeAdvanceDelete');

const ADVANCE_METHODS = ['drawer', 'easypaisa', 'jazzcash', 'bank'];

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

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
    
    const [transactions, total, allForBalance, openingTransactions] = await Promise.all([
      Transaction.find(query)
        .sort({ date: 1, createdAt: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Transaction.countDocuments(query),
      Transaction.find(query).sort({ date: 1, createdAt: 1 }).lean(),
      startDate
        ? Transaction.find({ date: { $lt: new Date(startDate) } }).lean()
        : Promise.resolve([]),
    ]);

    let openingBalance = 0;
    for (const t of openingTransactions) {
      openingBalance += t.type === 'deposit' ? t.amount : -t.amount;
    }
    openingBalance = Math.round(openingBalance * 100) / 100;

    let running = openingBalance;
    const balanceById = new Map();
    for (const t of allForBalance) {
      if (t.type === 'deposit') running += t.amount;
      else running -= t.amount;
      balanceById.set(String(t._id), Math.round(running * 100) / 100);
    }
    const closingBalance = Math.round(running * 100) / 100;
    
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
      runningBalance: balanceById.get(String(transaction._id)) ?? openingBalance,
    }));
    
    res.json({
      success: true,
      openingBalance,
      closingBalance,
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

// Delete transaction (vendor/customer advance reverses ledger + balances)
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    const isPartyAdvance =
      transaction.partyType &&
      (transaction.category === 'advance' ||
        String(transaction.description || '').toLowerCase().includes('advance'));
    if (isPartyAdvance) {
      const result = await deletePartyAdvanceTransaction(id);
      if (!result.ok) {
        return res.status(result.status || 400).json({
          success: false,
          message: result.message,
        });
      }
      const balances = await Transaction.getBalances();
      return res.json({
        success: true,
        message: result.message,
        balances,
      });
    }

    await Transaction.findByIdAndDelete(id);
    const balances = await Transaction.getBalances();

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
      balances,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting transaction',
      error: error.message,
    });
  }
};

/** Delete vendor/customer advance by transaction id (Finance tabs) */
exports.deletePartyAdvance = async (req, res) => {
  try {
    const txBefore = await Transaction.findById(req.params.transactionId).lean();
    const result = await deletePartyAdvanceTransaction(req.params.transactionId);
    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
      });
    }
    const balances = await Transaction.getBalances();
    let vendor = null;
    let customer = null;
    if (txBefore?.partyType === 'vendor' && txBefore.partyId) {
      vendor = await getVendorLinkedProfile(txBefore.partyId);
    }
    if (txBefore?.partyType === 'customer' && txBefore.partyId) {
      customer = await getCustomerLinkedProfile(txBefore.partyId);
    }
    res.json({
      success: true,
      message: result.message,
      balances,
      vendor,
      customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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

    await vendorController.updateVendorLedger(vendor.name, {
      type: 'advance',
      description: desc,
      credit: amt,
      debit: 0,
      paymentMethod: method,
      reference: ref,
      transactionId: transaction._id,
    });

    const vendorAfter = await Vendor.findById(vendorId).lean();
    const linked = await getVendorLinkedProfile(vendorId);
    const updatedBalances = await Transaction.getBalances();

    res.json({
      success: true,
      message: `Vendor ${vendor.name} ko Rs. ${amt.toLocaleString('en-PK')} advance diya (POP ledger sync)`,
      transaction,
      vendor: vendorAfter
        ? {
            _id: vendorAfter._id,
            name: vendorAfter.name,
            advanceBalance: vendorAfter.advanceBalance,
            payableBalance: vendorAfter.payableBalance,
          }
        : null,
      linked,
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

    const linked = await getCustomerLinkedProfile(customer._id);

    res.json({
      success: true,
      message: `Customer ${customer.customerName} se Rs. ${amt.toLocaleString('en-PK')} advance receive hua (POS sync)`,
      transaction,
      customer: {
        _id: customer._id,
        customerName: customer.customerName,
        financeAdvanceBalance: customer.financeAdvanceBalance,
        totalAdvanceCredit: linked?.customer?.totalAdvanceCredit,
        totalBalanceDue: linked?.customer?.totalBalanceDue,
      },
      linked,
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

/** Totals linked to POP (vendors) and POS (customers) */
exports.getAdvanceSummary = async (req, res) => {
  try {
    const [totals, vendorTxAgg, customerTxAgg, vendorPayCount, customerPayCount, totalVendors, totalCustomers] =
      await Promise.all([
        getGlobalPartyTotals(),
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
        Vendor.countDocuments({ advanceBalance: { $gt: 0 } }),
        Customer.countDocuments({ financeAdvanceBalance: { $gt: 0 } }),
        Vendor.countDocuments(),
        Customer.countDocuments(),
      ]);

    const vendorTx = vendorTxAgg[0] || { total: 0, count: 0 };
    const customerTx = customerTxAgg[0] || { total: 0, count: 0 };

    res.json({
      success: true,
      vendor: {
        financeAdvancePaid: Math.round((vendorTx.total || 0) * 100) / 100,
        paymentCount: vendorTx.count || 0,
        advanceBalance: totals.vendorAdvanceBalance,
        payableBalance: totals.vendorPayableBalance,
        netPayable: totals.vendorNetDisplay?.netPayable ?? totals.vendorNetPayable,
        remainingAdvance: totals.vendorNetDisplay?.remainingAdvance ?? 0,
        netDisplayMode: totals.vendorNetDisplay?.mode ?? 'payable',
        netDisplayAmount: totals.vendorNetDisplay?.amount ?? 0,
        popTotalBills: totals.pop.totalBills,
        popTotalPaid: totals.pop.totalPaid,
        popRemaining: totals.pop.totalRemaining,
        popAdvanceOnBills: totals.pop.advanceOnBills,
        vendorsWithAdvance: vendorPayCount,
        totalVendors,
      },
      customer: {
        financeAdvanceReceived: Math.round((customerTx.total || 0) * 100) / 100,
        paymentCount: customerTx.count || 0,
        financeAdvanceBalance: totals.financeAdvanceBalance,
        posAdvanceFromSales: totals.pos.advanceOnSales,
        posBalanceDue: totals.pos.totalRemaining,
        profileBalanceDue: totals.profileBalanceDue,
        totalAdvanceCredit: totals.customerTotalAdvance,
        totalBalanceDue: totals.customerTotalDue,
        customersWithAdvance: customerPayCount,
        totalCustomers,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getVendorLinked = async (req, res) => {
  try {
    const linked = await getVendorLinkedProfile(req.params.vendorId);
    if (!linked) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.json({ success: true, data: linked });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCustomerLinked = async (req, res) => {
  try {
    const linked = await getCustomerLinkedProfile(req.params.customerId);
    if (!linked) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json({ success: true, data: linked });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVendorAdvanceHistory = async (req, res) => {
  try {
    const linked = await getVendorLinkedProfile(req.params.vendorId);
    if (!linked) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const vendorDoc = await Vendor.findById(req.params.vendorId).lean();
    const ledgerRaw = vendorDoc?.ledger || [];

    const history = ledgerRaw.map((e) => {
      const isFinanceAdvance =
        e.type === 'advance' && e.transactionId && !e.purchaseId;
      return {
        _id: e._id,
        date: e.date,
        type: e.type,
        amount: e.type === 'purchase' ? num(e.debit) : num(e.credit),
        method: e.paymentMethod || '',
        description: e.description,
        reference: e.reference,
        balance: e.balance,
        transactionId: e.transactionId ? String(e.transactionId) : undefined,
        canDelete: !!isFinanceAdvance,
        source:
          e.type === 'advance' && e.transactionId
            ? 'finance'
            : e.type === 'apply_advance'
              ? 'pop_advance'
              : 'pop',
      };
    });

    res.json({
      success: true,
      vendor: linked.vendor,
      pop: linked.pop,
      openBills: linked.openBills,
      history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteCustomerAdvanceEntry = async (req, res) => {
  try {
    const result = await deleteCustomerAdvanceEntry(
      req.params.customerId,
      req.params.entryId
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
      });
    }
    const balances = await Transaction.getBalances();
    const customer = await getCustomerLinkedProfile(req.params.customerId);
    res.json({
      success: true,
      message: result.message,
      balances,
      customer,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCustomerAdvanceHistory = async (req, res) => {
  try {
    const linked = await getCustomerLinkedProfile(req.params.customerId);
    if (!linked) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({
      success: true,
      customer: linked.customer,
      pos: linked.pos,
      history: linked.history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};