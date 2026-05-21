const express = require('express');
const activityLogController = require('../controllers/activityLog.controller');
const router = express.Router();

router.get('/', activityLogController.getActivityLogs);

module.exports = router;
