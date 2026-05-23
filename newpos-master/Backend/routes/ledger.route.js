const express = require('express');
const ledgerController = require('../controllers/ledger.controller');

const router = express.Router();

router.get('/meta', ledgerController.getMeta);
router.get('/rm-summary', ledgerController.getRmSummary);
router.get('/rm/:code', ledgerController.getRmDetail);
router.get('/fp-summary', ledgerController.getFpSummary);
router.get('/fp/:code', ledgerController.getFpDetail);
router.get('/purchases', ledgerController.getPurchaseLedger);
router.get('/sales', ledgerController.getSalesLedger);
router.get('/vendor/:vendorId', ledgerController.getVendorLedger);
router.get('/customer/:customerId', ledgerController.getCustomerLedger);
router.get('/owner-advance', ledgerController.getOwnerAdvanceLedger);
router.get('/employee/:employeeId', ledgerController.getEmployeeAdvanceLedger);

module.exports = router;
