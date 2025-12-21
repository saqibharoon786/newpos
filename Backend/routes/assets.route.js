const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assets.controller');

// Simple routes without authentication middleware
router.post('/create-assets', assetController.createAsset);
router.get('/get-all', assetController.getAllAssets);
router.get('/stats', assetController.getAssetStats);
router.get('/:id', assetController.getAssetById);
router.put('/:id', assetController.updateAsset);
router.delete('/:id', assetController.deleteAsset);

module.exports = router;