const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assets.controller');
const { upload } = require('../utils/upload');

// CREATE ASSET - with file upload support
router.post(
  '/create-assets',
  upload.single('receiptImage'), // ← FIXED: matches frontend field name 'receiptImage'
  (req, res, next) => {
    // This middleware runs AFTER multer has processed the request
    console.log("===== ASSET CREATE DEBUG LOG =====");
    console.log("📄 Request Method:", req.method);
    console.log("📄 Request URL:", req.originalUrl);
    console.log("📄 Content-Type:", req.headers['content-type']);
    console.log("📄 Request Body (text fields):", req.body);
    
    if (req.file) {
      console.log("📄 File Received:", {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path,
        destination: req.file.destination
      });
    } else {
      console.log("⚠️ No file uploaded in this request (receiptImage is optional)");
    }
    
    console.log("===== END DEBUG LOG =====");
    next();
  },
  assetController.createAsset
);

// UPDATE ASSET - also supports receipt image update
router.put(
  '/:id',
  upload.single('receiptImage'), // ← FIXED: consistent with create route
  (req, res, next) => {
    console.log("===== ASSET UPDATE DEBUG LOG =====");
    console.log("📄 Update ID:", req.params.id);
    if (req.file) {
      console.log("📄 Update File Received:", {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        path: req.file.path
      });
    } else {
      console.log("ℹ️ No new receipt image in update request");
    }
    console.log("===== END DEBUG LOG =====");
    next();
  },
  assetController.updateAsset
);

// Other routes (no file upload needed)
router.get('/get-all', assetController.getAllAssets);
router.get('/stats', assetController.getAssetStats);
router.get('/:id', assetController.getAssetById);
router.delete('/:id', assetController.deleteAsset);

// Optional: Keep this test route for quick debugging
router.post(
  '/test-upload',
  upload.single('receiptImage'),
  (req, res) => {
    console.log('🔍 TEST UPLOAD - File:', req.file);
    console.log('🔍 TEST UPLOAD - Body:', req.body);
    
    res.json({
      success: true,
      message: 'Test upload successful',
      fileReceived: !!req.file,
      fileDetails: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        path: req.file.path
      } : null,
      body: req.body
    });
  }
);

module.exports = router;