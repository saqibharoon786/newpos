const express = require("express");
const router = express.Router();
const popController = require("../controllers/pop.controller");
const multer = require("multer");
const path = require("path");

// Multer configuration for vehicle images
const vehicleStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create vehicles folder if it doesn't exist
    const vehiclesDir = path.join(__dirname, "../uploads/vehicles");
    const fs = require("fs");
    if (!fs.existsSync(vehiclesDir)) {
      fs.mkdirSync(vehiclesDir, { recursive: true });
    }
    cb(null, vehiclesDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, "vehicle-" + uniqueSuffix + extension);
  }
});

// File filter for vehicle images (images only)
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and GIF images are allowed.'), false);
  }
};

const vehicleUpload = multer({
  storage: vehicleStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// ✅ PURCHASE ROUTES

// Create new purchase with vehicle image
router.post("/add", vehicleUpload.single("vehicleImage"), popController.addPurchase);

// Get all purchases
router.get("/get-all", popController.getPurchases);

// Vendor balance/ledger by name
router.get("/vendor/:name/balance", popController.getVendorBalance);

// Owner approve purchase
router.patch("/:id/approve", popController.approvePurchase);

// Get purchase statistics
router.get("/statistics", popController.getPurchaseStatistics);

// Get all purchases with remaining weight calculation
router.get("/with-remaining", popController.getAllPurchasesWithRemainingWeight);

// Get purchase by ID
router.get("/:id", popController.getPurchaseById);

// Get purchase by ID with remaining weight
router.get("/:id/with-remaining", popController.getPurchaseWithRemainingWeight);

// Update purchase with vehicle image
router.put("/:id", vehicleUpload.single("vehicleImage"), popController.updatePurchase);

// Delete purchase (owner only)
const { requireOwner, blockAccountantDelete } = require("../middleware/cmsAuth");
router.delete("/:id", blockAccountantDelete, requireOwner, popController.deletePurchase);

module.exports = router;