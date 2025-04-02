// services/notificationService.js
const { publisher, subscriber } = require("../config/redis");
const Notification = require("../models/notification");
const { pool } = require("../config/db");
const { LanguageUtils } = require("../config/i18n");

const NOTIFICATION_CHANNELS = {
  EVENT_UPDATES: "event-updates",
  EVENT_REMINDERS: "event-reminders",
  USER_NOTIFICATIONS: "user-notifications",
};

class NotificationService {
  constructor() {
    this.setupSubscribers();
  }

  // Initialize Redis subscribers for notification channels
  async setupSubscribers() {
    try {
      await subscriber.subscribe(
        NOTIFICATION_CHANNELS.EVENT_UPDATES,
        this.handleEventUpdate
      );
      await subscriber.subscribe(
        NOTIFICATION_CHANNELS.EVENT_REMINDERS,
        this.handleEventReminder
      );
      console.log("Notification subscribers setup successfully");
    } catch (error) {
      console.error("Error setting up notification subscribers:", error);
    }
  }

  // Process event update notifications for interested users
  handleEventUpdate = async (message) => {
    try {
      const eventData = JSON.parse(message);
      const interestedUsers = await this.findInterestedUsers(
        eventData.id,
        eventData.category
      );

      for (const user of interestedUsers) {
        const message = LanguageUtils.translate(
          "events.updated",
          { event: eventData.title, changes: eventData.changes },
          { lng: user.language }
        );

        await Notification.create({
          userId: user.id,
          type: "EVENT_UPDATE",
          message,
          eventId: eventData.id,
        });

        await this.sendUserRealTimeNotification(user.id, {
          type: "EVENT_UPDATE",
          message,
          eventId: eventData.id,
        });

        const emailSubject = LanguageUtils.translate(
          "email.eventUpdate.subject",
          { event: eventData.title },
          { lng: user.language }
        );

        await this.sendEmailNotification(user.id, emailSubject, message);
      }
    } catch (error) {
      console.error("Error handling event update notification:", error);
    }
  };

  // Process event reminder notifications for registered users
  handleEventReminder = async (message) => {
    try {
      const reminderData = JSON.parse(message);

      for (const userId of reminderData.userIds) {
        const userLanguage = await this.getUserLanguage(userId);
        const message = LanguageUtils.translate(
          "events.reminder",
          { event: reminderData.title, time: reminderData.formattedTime },
          { lng: userLanguage }
        );

        await Notification.create({
          userId,
          type: "EVENT_REMINDER",
          message,
          eventId: reminderData.id,
        });

        await this.sendUserRealTimeNotification(userId, {
          type: "EVENT_REMINDER",
          message,
          eventId: reminderData.id,
        });

        const emailSubject = LanguageUtils.translate(
          "email.eventReminder.subject",
          { event: reminderData.title },
          { lng: userLanguage }
        );

        await this.sendEmailNotification(userId, emailSubject, message);
      }
    } catch (error) {
      console.error("Error handling event reminder notification:", error);
    }
  };

  // Publish event update to Redis channel
  async publishEventUpdate(eventData) {
    try {
      await publisher.publish(
        NOTIFICATION_CHANNELS.EVENT_UPDATES,
        JSON.stringify(eventData)
      );
      return true;
    } catch (error) {
      console.error("Error publishing event update:", error);
      return false;
    }
  }

  // Schedule event reminder to be sent at appropriate time
  async scheduleEventReminder(event, reminderTimeMs = 24 * 60 * 60 * 1000) {
    try {
      const interestedUsers = await this.findInterestedUsers(
        event.id,
        event.category
      );
      const userIds = interestedUsers.map((user) => user.id);
      if (userIds.length === 0) return true;

      const eventTime = new Date(event.start_time).getTime();
      const reminderTime = eventTime - reminderTimeMs;
      const currentTime = Date.now();

      const reminderData = {
        id: event.id,
        title: event.title,
        formattedTime: new Date(event.start_time).toLocaleString(),
        userIds,
      };

      if (reminderTime > currentTime) {
        const delayMs = reminderTime - currentTime;
        setTimeout(async () => {
          await publisher.publish(
            NOTIFICATION_CHANNELS.EVENT_REMINDERS,
            JSON.stringify(reminderData)
          );
        }, delayMs);
      } else {
        await publisher.publish(
          NOTIFICATION_CHANNELS.EVENT_REMINDERS,
          JSON.stringify(reminderData)
        );
      }

      return true;
    } catch (error) {
      console.error("Error scheduling event reminder:", error);
      return false;
    }
  }

  // Send direct notification to a specific user
  async sendDirectNotification(userId, type, message, eventId = null) {
    try {
      await Notification.create({ userId, type, message, eventId });

      await this.sendUserRealTimeNotification(userId, {
        type,
        message,
        eventId,
      });

      const emailSubject = LanguageUtils.translate(
        `email.${type.toLowerCase()}.subject`,
        { event: eventId ? await this.getEventTitle(eventId) : "" },
        { lng: await this.getUserLanguage(userId) }
      );

      await this.sendEmailNotification(userId, emailSubject, message);
      return true;
    } catch (error) {
      console.error("Error sending direct notification:", error);
      return false;
    }
  }

  // Find users interested in a specific event
  async findInterestedUsers(eventId, category) {
    try {
      const query = `
                SELECT DISTINCT u.id, u.language
                FROM users u
                WHERE (
                    $1 = ANY(u.preferred_categories)
                    OR EXISTS (
                        SELECT 1 FROM event_registrations er
                        WHERE er.user_id = u.id AND er.event_id = $2
                    )
                    OR EXISTS (
                        SELECT 1 FROM events e
                        WHERE e.id = $2 AND e.created_by = u.id
                    )
                )
                AND u.status = 'active'
            `;

      const result = await pool.query(query, [category, eventId]);
      return result.rows;
    } catch (error) {
      console.error("Error finding interested users:", error);
      return [];
    }
  }

  // Get user's language preference
  async getUserLanguage(userId) {
    try {
      const result = await pool.query(
        "SELECT language FROM users WHERE id = $1",
        [userId]
      );
      return result.rows[0]?.language || "en";
    } catch (error) {
      console.error("Error getting user language:", error);
      return "en";
    }
  }

  // Get event title by ID
  async getEventTitle(eventId) {
    try {
      const result = await pool.query(
        "SELECT title FROM events WHERE id = $1",
        [eventId]
      );
      return result.rows[0]?.title || "";
    } catch (error) {
      console.error("Error getting event title:", error);
      return "";
    }
  }

  // Send email notification to user
  async sendEmailNotification(userId, subject, message) {
    try {
      const result = await pool.query("SELECT email FROM users WHERE id = $1", [
        userId,
      ]);
      const userEmail = result.rows[0]?.email;

      if (!userEmail) {
        console.error(`No email found for user ${userId}`);
        return false;
      }

      console.log(
        `[Email notification] To: ${userEmail}, Subject: ${subject}, Message: ${message}`
      );
      return true;
    } catch (error) {
      console.error("Error sending email notification:", error);
      return false;
    }
  }

  // Send real-time notification via Redis channel
  async sendUserRealTimeNotification(userId, notificationData) {
    try {
      await publisher.publish(
        `user-${userId}-notifications`,
        JSON.stringify(notificationData)
      );
    } catch (error) {
      console.error("Error sending real-time notification:", error);
    }
  }
}

const notificationService = new NotificationService();

module.exports = {
  notificationService,
  NOTIFICATION_CHANNELS,
};
