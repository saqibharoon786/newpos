const express = require('express');
const vendorController = require('../controllers/vendor.controller');
const router = express.Router();

router.get('/', vendorController.getVendors);
router.get('/ledger-balances', vendorController.getVendorLedgerBalances);
router.post('/', vendorController.createVendor);
router.get('/:id/ledger', vendorController.getVendorLedger);
router.get('/:id', vendorController.getVendorById);
router.put('/:id', vendorController.updateVendor);
router.delete('/:id', vendorController.deleteVendor);

module.exports = router;
