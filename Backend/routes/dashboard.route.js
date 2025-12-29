const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');

// Dashboard routes
router.get('/stats', dashboardController.getDashboardStats);
router.get('/chart-data', dashboardController.getSalesExpensesChart);
router.get('/recent-activity', dashboardController.getRecentActivity);
router.get('/roznamcha', dashboardController.getRoznamchaData);
router.get('/monthly-summary', dashboardController.getMonthlySummary);

// Development only routes
if (process.env.NODE_ENV !== 'production') {
  router.post('/create-test-data', dashboardController.createTestData);
}

module.exports = router;