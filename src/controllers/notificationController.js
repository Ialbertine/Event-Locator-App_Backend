// controllers/notificationController.js
const Notification = require('../models/notification');
const { notificationService } = require('../services/notificationService');
const { LanguageUtils } = require('../config/i18n');

// Get all notifications for the current user
exports.getNotifications = async (req, res, next) => {
    try {
        const userId = req.user.id; 
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        const notifications = await Notification.getByUserId(userId, limit, offset);
        const unreadCount = await Notification.getUnreadCount(userId);
        
        res.status(200).json({
            success: true,
            data: {
                notifications,
                unreadCount,
                pagination: {
                    page,
                    limit,
                    hasMore: notifications.length === limit
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// Mark a notification as read
exports.markAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { notificationId } = req.params;
        
        const notification = await Notification.markAsRead(notificationId, userId);
        
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: LanguageUtils.translate('notifications.notFound', { lng: req.language })
            });
        }
        
        res.status(200).json({
            success: true,
            data: notification
        });
    } catch (error) {
        next(error);
    }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        await Notification.markAllAsRead(userId);
        
        res.status(200).json({
            success: true,
            message: LanguageUtils.translate('notifications.allMarkedAsRead', { lng: req.language })
        });
    } catch (error) {
        next(error);
    }
};

// Delete a notification
exports.deleteNotification = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { notificationId } = req.params;
        
        const notification = await Notification.delete(notificationId, userId);
        
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: LanguageUtils.translate('notifications.notFound', { lng: req.language })
            });
        }
        
        res.status(200).json({
            success: true,
            message: LanguageUtils.translate('notifications.deleted', { lng: req.language })
        });
    } catch (error) {
        next(error);
    }
};

// Create a notification for testing purposes (admin only)
exports.createTestNotification = async (req, res, next) => {
    try {
        // Check if user is admin (you'd need to implement this check)
        if (!req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: LanguageUtils.translate('auth.forbidden', { lng: req.language })
            });
        }
        
        const { userId, type, message, eventId } = req.body;
        
        if (!userId || !type || !message) {
            return res.status(400).json({
                success: false,
                message: LanguageUtils.translate('validation.missingFields', { lng: req.language })
            });
        }
        
        await notificationService.sendDirectNotification(
            userId,
            type,
            message,
            eventId || null
        );
        
        res.status(201).json({
            success: true,
            message: LanguageUtils.translate('notifications.created', { lng: req.language })
        });
    } catch (error) {
        next(error);
    }
};