const { pool } = require('../config/db');

class Notification {
    // Create notification in database
    static async create({ userId, type, message, eventId = null, isRead = false }) {
        try {
            const query = `
                INSERT INTO notifications (
                    user_id, type, message, event_id, is_read, created_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING *
            `;
            
            const values = [userId, type, message, eventId, isRead];
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    // Get all notifications for a user
    static async getByUserId(userId, limit = 50, offset = 0) {
        try {
            const query = `
                SELECT * FROM notifications
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            `;
            
            const result = await pool.query(query, [userId, limit, offset]);
            return result.rows;
        } catch (error) {
            console.error('Error fetching notifications:', error);
            throw error;
        }
    }

    // Get unread notifications count
    static async getUnreadCount(userId) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM notifications
                WHERE user_id = $1 AND is_read = false
            `;
            
            const result = await pool.query(query, [userId]);
            return parseInt(result.rows[0].count);
        } catch (error) {
            console.error('Error counting unread notifications:', error);
            throw error;
        }
    }

    // Mark notification as read
    static async markAsRead(notificationId, userId) {
        try {
            const query = `
                UPDATE notifications
                SET is_read = true, updated_at = NOW()
                WHERE id = $1 AND user_id = $2
                RETURNING *
            `;
            
            const result = await pool.query(query, [notificationId, userId]);
            return result.rows[0];
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }

    // Mark all notifications as read for a user
    static async markAllAsRead(userId) {
        try {
            const query = `
                UPDATE notifications
                SET is_read = true, updated_at = NOW()
                WHERE user_id = $1 AND is_read = false
                RETURNING *
            `;
            
            const result = await pool.query(query, [userId]);
            return result.rows;
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            throw error;
        }
    }

    // Delete a notification
    static async delete(notificationId, userId) {
        try {
            const query = `
                DELETE FROM notifications
                WHERE id = $1 AND user_id = $2
                RETURNING *
            `;
            
            const result = await pool.query(query, [notificationId, userId]);
            return result.rows[0];
        } catch (error) {
            console.error('Error deleting notification:', error);
            throw error;
        }
    }
}

module.exports = Notification;