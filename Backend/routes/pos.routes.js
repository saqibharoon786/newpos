const express = require("express");
const router = express.Router();
const saleController = require("../controllers/pos.controller");
const upload = require("../middleware/multer");
// Apply upload middleware only to routes that need it
router.post("/add-sale", upload.single("receiptImage"), saleController.addSale);
router.get("/", saleController.getSales);
router.get("/:id", saleController.getSaleById);
router.put("/:id", upload.single("receiptImage"), saleController.updateSale);
router.delete("/:id", saleController.deleteSale);

module.exports = router;