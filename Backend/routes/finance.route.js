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

module.exports = router;