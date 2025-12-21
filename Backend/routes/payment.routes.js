const express = require("express");
const router = express.Router();
const {
  processPayment,
  getPayments,
  getPaymentById,
  getMemberPaymentHistory,
  getMemberPaymentSummary,
  updatePayment,
  processRefund,
  deletePayment,
  getPaymentStats,
  generateInvoice,
} = require("../controllers/payment.controller");

const { protect, authorize } = require("../middleware/auth");

// All routes are protected
router.use(protect);

// @route   POST /api/v1/payments
// @desc    Process new payment
// @access  Private (Staff, Admin)
router.post("/", authorize("staff", "admin"), processPayment);

// @route   GET /api/v1/payments
// @desc    Get all payments with filtering and pagination
// @access  Private (Staff, Admin)
router.get("/", authorize("staff", "admin"), getPayments);

// @route   GET /api/v1/payments/:id
// @desc    Get payment by ID
// @access  Private (Staff, Admin)
router.get("/:id", authorize("staff", "admin"), getPaymentById);

// @route   GET /api/v1/payments/member/:memberId
// @desc    Get payment history for a specific member
// @access  Private (Staff, Admin)
router.get("/member/:memberId", authorize("staff", "admin"), getMemberPaymentHistory);

// @route   GET /api/v1/payments/member/:memberId/summary
// @desc    Get payment summary for a specific member
// @access  Private (Staff, Admin)
router.get("/member/:memberId/summary", authorize("staff", "admin"), getMemberPaymentSummary);

// @route   PUT /api/v1/payments/:id
// @desc    Update payment
// @access  Private (Staff, Admin)
router.put("/:id", authorize("staff", "admin"), updatePayment);

// @route   PUT /api/v1/payments/:id/refund
// @desc    Process payment refund
// @access  Private (Admin only)
router.put("/:id/refund", authorize("admin"), processRefund);

// @route   DELETE /api/v1/payments/:id
// @desc    Delete payment
// @access  Private (Admin only)
router.delete("/:id", authorize("admin"), deletePayment);

// @route   GET /api/v1/payments/stats
// @desc    Get payment statistics
// @access  Private (Admin only)
router.get("/stats/admin", authorize("admin"), getPaymentStats);

// @route   POST /api/v1/payments/:id/invoice
// @desc    Generate invoice for payment
// @access  Private (Staff, Admin)
router.post("/:id/invoice", authorize("staff", "admin"), generateInvoice);

module.exports = router;