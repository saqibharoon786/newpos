const paymentService = require("../services/payment.service");
const { asyncHandler } = require("../utils/asyncHandler");
const { createResponse } = require("../utils/response");
const { HTTP_STATUS } = require("../middleware/constants");

// @route   POST /api/v1/payments
// @desc    Process new payment
// @access  Private
const processPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.processPayment(req.body, req.user.id);
  res
    .status(HTTP_STATUS.CREATED)
    .json(createResponse(true, "Payment processed successfully", { payment }));
});

// @route   GET /api/v1/payments
// @desc    Get all payments with filtering and pagination
// @access  Private
const getPayments = asyncHandler(async (req, res) => {
  const filters = {
    memberId: req.query.memberId,
    method: req.query.method,
    status: req.query.status,
    type: req.query.type,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
  };

  const pagination = {
    page: Number.parseInt(req.query.page) || 1,
    limit: Number.parseInt(req.query.limit) || 20,
  };

  const result = await paymentService.getPayments(filters, pagination);

  res.status(HTTP_STATUS.OK).json(
    createResponse(
      true,
      "Payments retrieved successfully",
      {
        payments: result.payments,
        pagination: result.pagination
      }
    )
  );
});

// @route   GET /api/v1/payments/:id
// @desc    Get payment by ID
// @access  Private
const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPaymentById(req.params.id);
  res
    .status(HTTP_STATUS.OK)
    .json(createResponse(true, "Payment retrieved successfully", { payment }));
});

// @route   GET /api/v1/payments/member/:memberId
// @desc    Get payment history for a specific member
// @access  Private
const getMemberPaymentHistory = asyncHandler(async (req, res) => {
  const filters = {
    method: req.query.method,
    status: req.query.status,
    type: req.query.type,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  };

  const pagination = {
    page: Number.parseInt(req.query.page) || 1,
    limit: Number.parseInt(req.query.limit) || 20,
  };

  const result = await paymentService.getMemberPaymentHistory(
    req.params.memberId, 
    filters, 
    pagination
  );

  res.status(HTTP_STATUS.OK).json(
    createResponse(
      true,
      "Member payment history retrieved successfully",
      result
    )
  );
});

// @route   GET /api/v1/payments/member/:memberId/summary
// @desc    Get payment summary for a specific member
// @access  Private
const getMemberPaymentSummary = asyncHandler(async (req, res) => {
  const summary = await paymentService.getMemberPaymentSummary(req.params.memberId);
  res
    .status(HTTP_STATUS.OK)
    .json(createResponse(true, "Member payment summary retrieved successfully", summary));
});

// @route   PUT /api/v1/payments/:id
// @desc    Update payment
// @access  Private
const updatePayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.updatePayment(req.params.id, req.body);
  res
    .status(HTTP_STATUS.OK)
    .json(createResponse(true, "Payment updated successfully", { payment }));
});

// @route   PUT /api/v1/payments/:id/refund
// @desc    Process payment refund
// @access  Private
const processRefund = asyncHandler(async (req, res) => {
  const payment = await paymentService.processRefund(req.params.id, req.body, req.user.id);
  res
    .status(HTTP_STATUS.OK)
    .json(createResponse(true, "Payment refund processed successfully", { payment }));
});

// @route   DELETE /api/v1/payments/:id
// @desc    Delete payment
// @access  Private (Admin only)
const deletePayment = asyncHandler(async (req, res) => {
  const result = await paymentService.deletePayment(req.params.id);
  res
    .status(HTTP_STATUS.OK)
    .json(createResponse(true, result.message));
});

// @route   GET /api/v1/payments/stats
// @desc    Get payment statistics
// @access  Private (Admin only)
const getPaymentStats = asyncHandler(async (req, res) => {
  const dateRange = {
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  };

  const stats = await paymentService.getPaymentStats(dateRange);

  res
    .status(HTTP_STATUS.OK)
    .json(createResponse(true, "Payment statistics retrieved successfully", stats));
});

// @route   POST /api/v1/payments/:id/invoice
// @desc    Generate invoice for payment
// @access  Private
const generateInvoice = asyncHandler(async (req, res) => {
  const invoice = await paymentService.generateInvoice(req.params.id);
  res
    .status(HTTP_STATUS.CREATED)
    .json(createResponse(true, "Invoice generated successfully", { invoice }));
});

module.exports = {
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
};