const express = require('express');
const router = express.Router();
const financeController = require('../controllers/finance.controller');

// Get all transactions with filters
router.get('/transactions', financeController.getTransactions);

// Get balances and stats
router.get('/balances', financeController.getBalances);

// Create deposit
router.post('/deposit', financeController.createDeposit);

// Create withdrawal
router.post('/withdraw', financeController.createWithdrawal);

// Update transaction
router.put('/transactions/:id', financeController.updateTransaction);

// Delete transaction
router.delete('/transactions/:id', financeController.deleteTransaction);

// Export transactions
router.get('/export', financeController.exportTransactions);

// Vendor / customer advance summary
router.get('/advance-summary', financeController.getAdvanceSummary);

// Vendor / customer advance payments
router.post('/vendor-advance', financeController.recordVendorAdvance);
router.post('/customer-advance', financeController.recordCustomerAdvance);
router.get('/vendor-advance/:vendorId/history', financeController.getVendorAdvanceHistory);
router.get('/customer-advance/:customerId/history', financeController.getCustomerAdvanceHistory);

module.exports = router;