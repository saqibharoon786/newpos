const express = require('express');
const notificationController = require('../controllers/notification.controller');
const router = express.Router();

router.get('/', notificationController.getNotifications);
router.patch('/:id/read', notificationController.markAsRead);

module.exports = router;
