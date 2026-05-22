const express = require("express");
const router = express.Router();
const posController = require("../controllers/pos.controller");
const multer = require("multer");
const path = require("path");

// Multer configuration for receipt images
const receiptStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create receipts folder if it doesn't exist
    const receiptsDir = path.join(__dirname, "../uploads/receipts");
    const fs = require("fs");
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }
    cb(null, receiptsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, "receipt-" + uniqueSuffix + extension);
  }
});

// File filter for receipts (images and PDF)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'), false);
  }
};

const receiptUpload = multer({
  storage: receiptStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// ✅ SALES ROUTES

// Create new sale with receipt image
router.post("/add-sale", receiptUpload.single("receiptImage"), posController.addSale);

// Next sale invoice (SI prefix — auto)
router.get("/next-invoice", posController.getNextSaleInvoiceNo);

// Get all sales
router.get("/", posController.getSales);

// Get sales statistics
router.get("/statistics", posController.getSalesStatistics);

// Get sale by ID
router.get("/:id", posController.getSaleById);

// Update sale with receipt image
router.put("/:id", receiptUpload.single("receiptImage"), posController.updateSale);

const { requireOwner, blockAccountantDelete } = require("../middleware/cmsAuth");
router.patch("/:id/approve", requireOwner, posController.approveSale);
router.delete("/:id", blockAccountantDelete, requireOwner, posController.deleteSale);

// ✅ MATERIAL-SPECIFIC ROUTES (for POP integration)

// Get all sales by material name
router.get("/sales-by-material/:materialName", posController.getSalesByMaterial);

// Get total sold weight by material
router.get("/total-sold-weight/:materialName", posController.getTotalSoldWeightByMaterial);

module.exports = router;