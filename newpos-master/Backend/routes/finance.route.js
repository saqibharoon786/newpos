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
router.get('/vendor-linked/:vendorId', financeController.getVendorLinked);
router.get('/customer-linked/:customerId', financeController.getCustomerLinked);

// Vendor / customer advance payments
router.post('/vendor-advance', financeController.recordVendorAdvance);
router.post('/customer-advance', financeController.recordCustomerAdvance);
router.get('/vendor-advance/:vendorId/history', financeController.getVendorAdvanceHistory);
router.get('/customer-advance/:customerId/history', financeController.getCustomerAdvanceHistory);
router.delete('/party-advance/:transactionId', financeController.deletePartyAdvance);
router.delete(
  '/customer-advance/:customerId/entry/:entryId',
  financeController.deleteCustomerAdvanceEntry
);

// Employee advance, repayment & salary
router.post('/employee-advance', financeController.recordEmployeeAdvance);
router.post('/employee-repayment', financeController.recordEmployeeRepayment);
router.post('/employee-salary', financeController.recordEmployeeSalary);
router.patch('/employee-advance-settings', financeController.updateEmployeeAdvanceSettings);
router.get('/employee-linked/:employeeId', financeController.getEmployeeLinked);
router.get('/employee-advance/:employeeId/history', financeController.getEmployeeAdvanceHistory);

// Owner advance & repayment
router.get('/owner-accounts', financeController.getOwnerAccounts);
router.post('/owner-advance', financeController.recordOwnerAdvance);
router.post('/owner-repayment', financeController.recordOwnerRepayment);
router.get('/owner-linked/:accountId', financeController.getOwnerLinked);
router.get('/owner-advance/:accountId/history', financeController.getOwnerAdvanceHistory);

module.exports = router;