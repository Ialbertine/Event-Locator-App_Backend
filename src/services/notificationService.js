// services/notificationService.js
const { publisher, subscriber } = require('../config/redis');
const Notification = require('../models/notification');
const { pool } = require('../config/db');
const { LanguageUtils } = require('../config/i18n');

// Define notification channels
const NOTIFICATION_CHANNELS = {
    EVENT_UPDATES: 'event-updates',
    EVENT_REMINDERS: 'event-reminders',
    USER_NOTIFICATIONS: 'user-notifications'
};

class NotificationService {
    constructor() {
        this.setupSubscribers();
    }

    // Set up Redis subscribers to listen for events
    async setupSubscribers() {
        try {
            // Subscribe to event updates channel
            await subscriber.subscribe(NOTIFICATION_CHANNELS.EVENT_UPDATES, this.handleEventUpdate);
            
            // Subscribe to event reminders channel
            await subscriber.subscribe(NOTIFICATION_CHANNELS.EVENT_REMINDERS, this.handleEventReminder);
            
            console.log('Notification subscribers setup successfully');
        } catch (error) {
            console.error('Error setting up notification subscribers:', error);
        }
    }

    // Handler for event updates
    handleEventUpdate = async (message) => {
        try {
            const eventData = JSON.parse(message);
            
            // Find all users who should be notified about this event update
            const interestedUsers = await this.findInterestedUsers(eventData.id, eventData.category);
            
            // Create notifications for each interested user
            for (const user of interestedUsers) {
                // this Translate message based on user's language preference
                const message = LanguageUtils.translate('events.updated', 
                    { 
                        event: eventData.title,
                        changes: eventData.changes 
                    },
                    { lng: user.language }
                );
                
                await Notification.create({
                    userId: user.id,
                    type: 'EVENT_UPDATE',
                    message,
                    eventId: eventData.id
                });
                
                // Send real-time notification if user is connected
                await this.sendUserRealTimeNotification(user.id, {
                    type: 'EVENT_UPDATE',
                    message,
                    eventId: eventData.id
                });
            }
        } catch (error) {
            console.error('Error handling event update notification:', error);
        }
    };

    // Handler for event reminders
    handleEventReminder = async (message) => {
        try {
            const reminderData = JSON.parse(message);
            
            // Create notifications for each user in the reminder
            for (const userId of reminderData.userIds) {
                // Get user language preference
                const userLanguage = await this.getUserLanguage(userId);
                
                // Translate message based on user's language preference
                const message = LanguageUtils.translate('events.reminder', 
                    { 
                        event: reminderData.title,
                        time: reminderData.formattedTime 
                    },
                    { lng: userLanguage }
                );
                
                await Notification.create({
                    userId,
                    type: 'EVENT_REMINDER',
                    message,
                    eventId: reminderData.id
                });
                
                // Send real-time notification if user is connected
                await this.sendUserRealTimeNotification(userId, {
                    type: 'EVENT_REMINDER',
                    message,
                    eventId: reminderData.id
                });
            }
        } catch (error) {
            console.error('Error handling event reminder notification:', error);
        }
    };

    // Publish an event update notification
    async publishEventUpdate(eventData) {
        try {
            await publisher.publish(
                NOTIFICATION_CHANNELS.EVENT_UPDATES, 
                JSON.stringify(eventData)
            );
            return true;
        } catch (error) {
            console.error('Error publishing event update:', error);
            return false;
        }
    }

    // Schedule and publish event reminders
    async scheduleEventReminder(event, reminderTimeMs = 24 * 60 * 60 * 1000) { // Default 24 hours before
        try {
            // Find users interested in this event
            const interestedUsers = await this.findInterestedUsers(event.id, event.category);
            const userIds = interestedUsers.map(user => user.id);
            
            if (userIds.length === 0) return true;
            
            // Calculate when to send reminder
            const eventTime = new Date(event.start_time).getTime();
            const reminderTime = eventTime - reminderTimeMs;
            const currentTime = Date.now();
            
            // Prepare reminder data
            const reminderData = {
                id: event.id,
                title: event.title,
                formattedTime: new Date(event.start_time).toLocaleString(),
                userIds
            };

            // If reminder time is in the future, schedule it
            if (reminderTime > currentTime) {
                const delayMs = reminderTime - currentTime;
                setTimeout(async () => {
                    await publisher.publish(
                        NOTIFICATION_CHANNELS.EVENT_REMINDERS,
                        JSON.stringify(reminderData)
                    );
                }, delayMs);
                console.log(`Scheduled reminder for event ${event.id} in ${delayMs}ms`);
            } else {
                // If event is too soon, send reminder immediately
                await publisher.publish(
                    NOTIFICATION_CHANNELS.EVENT_REMINDERS,
                    JSON.stringify(reminderData)
                );
            }
            
            return true;
        } catch (error) {
            console.error('Error scheduling event reminder:', error);
            return false;
        }
    }

    // Send a direct notification to a specific user
    async sendDirectNotification(userId, type, message, eventId = null) {
        try {
            // Create notification in database
            await Notification.create({
                userId,
                type,
                message,
                eventId
            });
            
            // Send real-time notification if user is connected
            await this.sendUserRealTimeNotification(userId, {
                type,
                message,
                eventId
            });
            
            return true;
        } catch (error) {
            console.error('Error sending direct notification:', error);
            return false;
        }
    }

    // Helper method to find users interested in an event
    async findInterestedUsers(eventId, category) {
        try {
            // This query finds users who:
            // Have the event category in their preferred categories, OR
            // Are registered for this event
            const query = `
                SELECT DISTINCT u.id, u.language
                FROM users u
                WHERE (
                    $1 = ANY(u.preferred_categories)
                    OR EXISTS (
                        SELECT 1 FROM event_registrations er
                        WHERE er.user_id = u.id AND er.event_id = $2
                    )
                )
                AND u.status = 'active'
            `;
            
            const result = await pool.query(query, [category, eventId]);
            return result.rows;
        } catch (error) {
            console.error('Error finding interested users:', error);
            return [];
        }
    }

    // Helper method to get user's language preference
    async getUserLanguage(userId) {
        try {
            const query = `
                SELECT language FROM users
                WHERE id = $1
            `;
            
            const result = await pool.query(query, [userId]);
            return result.rows[0]?.language || 'en';
        } catch (error) {
            console.error('Error getting user language:', error);
            return 'en'; // Default to English
        }
    }

    // Helper method to send real-time notification
    // This would connect to your WebSocket implementation
    async sendUserRealTimeNotification(userId, notificationData) {
        // Placeholder for real-time notification sending
        // You would implement this with WebSockets or Server-Sent Events
        console.log(`[Real-time notification] User ${userId}:`, notificationData);
        
        // Example implementation with WebSockets would go here
        // For now, we'll just publish to a Redis channel for the user
        try {
            await publisher.publish(
                `user-${userId}-notifications`,
                JSON.stringify(notificationData)
            );
        } catch (error) {
            console.error('Error sending real-time notification:', error);
        }
    }
}

// Create singleton instance
const notificationService = new NotificationService();

module.exports = {
    notificationService,
    NOTIFICATION_CHANNELS
};