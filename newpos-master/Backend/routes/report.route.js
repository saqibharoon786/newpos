const express = require('express');
const reportController = require('../controllers/report.controller');
const router = express.Router();

router.get('/profit-loss', reportController.getProfitLossReport);
router.get('/business-pipeline', reportController.getBusinessPipelineReport);
router.get('/daily-movement', reportController.getDailyMovementReport);
router.get('/customer-ledger', reportController.getCustomerLedgerReport);

module.exports = router;
