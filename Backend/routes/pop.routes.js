const express = require("express");
const multer = require("multer");
const {
  addPurchase,
  getPurchases,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
} = require("../controllers/pop.controller");

const router = express.Router();

// Multer configuration (for vehicleImage)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Routes
router.post("/add", upload.single("vehicleImage"), addPurchase);
router.get("/get-all", getPurchases);
router.get("/:id", getPurchaseById);
router.put("/:id", upload.single("vehicleImage"), updatePurchase);
router.delete("/:id", deletePurchase);

module.exports = router;
