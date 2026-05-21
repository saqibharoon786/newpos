const express = require('express');
const vendorController = require('../controllers/vendor.controller');
const router = express.Router();

router.get('/', vendorController.getVendors);
router.post('/', vendorController.createVendor);
router.get('/:id/ledger', vendorController.getVendorLedger);

module.exports = router;
