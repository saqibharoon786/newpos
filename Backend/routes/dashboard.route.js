// dashboard.express.route.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { asyncHandler } = require('../utils/asyncHandler');

// Dashboard routes (bind so controller methods can use this.getDashboardStatsFallback etc.)
router.get('/stats', asyncHandler(dashboardController.getDashboardStats.bind(dashboardController)));
router.get('/chart-data', asyncHandler(dashboardController.getSalesExpensesChart.bind(dashboardController)));
router.get('/roznamcha', asyncHandler(dashboardController.getRoznamchaData.bind(dashboardController)));
router.get('/monthly-summary', asyncHandler(dashboardController.getMonthlySummary.bind(dashboardController)));

module.exports = router;