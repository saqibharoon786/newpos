const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expense.controller");

// Validation middleware
const validateExpense = (req, res, next) => {
  const { subject, description, price, date, time } = req.body;

  if (!subject || !description || !price || !date || !time) {
    return res.status(400).json({
      success: false,
      message: "Subject, description, price, date, and time are required",
    });
  }

  next();
};

// Routes
router.get("/get-all", expenseController.getAllExpenses);
router.get("/stats", expenseController.getExpenseStats);
router.get("/:id", expenseController.getExpenseById);
router.post("/create-expense", validateExpense, expenseController.createExpense);
router.put("/:id", expenseController.updateExpense);
router.delete("/:id", expenseController.deleteExpense);

module.exports = router;