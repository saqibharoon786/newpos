// dashboard.express.route.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');

// Dashboard routes (bind so controller methods can use this.getDashboardStatsFallback etc.)
router.get('/stats', dashboardController.getDashboardStats.bind(dashboardController));
router.get('/chart-data', dashboardController.getSalesExpensesChart.bind(dashboardController));
router.get('/roznamcha', dashboardController.getRoznamchaData.bind(dashboardController));
router.get('/monthly-summary', dashboardController.getMonthlySummary.bind(dashboardController));

module.exports = router;