// dashboard.express.route.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');

// Dashboard routes
router.get('/stats', dashboardController.getDashboardStats);
router.get('/chart-data', dashboardController.getSalesExpensesChart);
router.get('/roznamcha', dashboardController.getRoznamchaData);
router.get('/monthly-summary', dashboardController.getMonthlySummary);

module.exports = router;