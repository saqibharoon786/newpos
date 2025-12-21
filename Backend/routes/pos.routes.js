const express = require("express");
const {
  addSale,
  getSales,
  getSaleById,
  updateSale,
  deleteSale,
} = require("../controllers/pos.controller");

const router = express.Router();

router.post("/add-sale", addSale);
router.get("/", getSales);
router.get("/:id", getSaleById);
router.put("/:id", updateSale);
router.delete("/:id", deleteSale);

module.exports = router;
