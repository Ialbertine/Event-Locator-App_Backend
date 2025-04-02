const express = require('express');
const Auth = require('../middlewares/auth');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

// All notification needs authentication
router.use(Auth.authenticate);

// Get all notifications for the current user
router.get('/', notificationController.getNotifications);

// Mark a notification as read
router.patch('/:notificationId/read', notificationController.markAsRead);

// Mark all notifications as read
router.patch('/read-all', notificationController.markAllAsRead);

// Delete a notification
router.delete('/:notificationId', notificationController.deleteNotification);

module.exports = router;