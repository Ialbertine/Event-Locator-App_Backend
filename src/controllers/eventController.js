const Event = require("../models/event");
const { redisCacheInstance } = require("../config/redis");
const { database } = require("../config/db");
const { notificationService } = require("../services/notificationService");

const CACHE_EXPIRATION = 60 * 15;
const CACHE_PREFIX = "event:";

class EventController {
  // Create new event with validation and notifications
  async createEvent(req, res) {
    try {
      const validFields = [
        "title",
        "description",
        "address",
        "start_time",
        "end_time",
        "category",
        "longitude",
        "latitude",
        "ticket_price",
        "status",
      ];

      const eventData = {};
      validFields.forEach((field) => {
        if (req.body[field] !== undefined) eventData[field] = req.body[field];
      });

      const requiredFields = [
        "title",
        "address",
        "start_time",
        "end_time",
        "category",
        "longitude",
        "latitude",
      ];
      const missingFields = requiredFields.filter((field) => !eventData[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: req.t("event.create.error.missing_fields", {
            fields: missingFields.join(", "),
          }),
        });
      }

      eventData.created_by = req.user.id;
      const newEvent = await Event.create(eventData);

      await notificationService.scheduleEventReminder(newEvent);
      await redisCacheInstance.delete(`${CACHE_PREFIX}categories`);

      return res.status(201).json({
        success: true,
        message: req.t("event.create.success"),
        data: newEvent,
      });
    } catch (error) {
      console.error("Error creating event:", error);
      return res.status(500).json({
        success: false,
        message: req.t("event.create.error.server"),
      });
    }
  }

  // Get events with filtering and pagination
  async getEvents(req, res) {
    try {
      let {
        category,
        startDate,
        endDate,
        limit = 20,
        offset = 0,
        name,
        address,
        created_by,
      } = req.query;

      if (category !== undefined) {
        category = category.trim();
        if (category === "") {
          category = undefined;
        }
      }

      const cacheKey = `${CACHE_PREFIX}list:${name || ""}:${
        category || "all"
      }:${startDate || ""}:${endDate || ""}:${address || ""}:${
        created_by || ""
      }:${limit}:${offset}`;
      const cachedEvents = await redisCacheInstance.get(cacheKey);

      if (cachedEvents) {
        return res.status(200).json({
          success: true,
          data: cachedEvents,
          fromCache: true,
        });
      }

      const filters = {
        name,
        category,
        startDate,
        endDate,
        address,
        created_by,
        limit: parseInt(limit),
        offset: parseInt(offset),
      };

      const events = await Event.getAll(filters);
      const total = await Event.count(filters);

      const response = {
        success: true,
        message: req.t("event.get.success"),
        data: {
          events,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: total > parseInt(offset) + parseInt(limit),
          },
        },
      };

      await redisCacheInstance.set(cacheKey, response.data, CACHE_EXPIRATION);
      return res.status(200).json(response);
    } catch (error) {
      console.error("Error fetching events:", error);
      return res.status(500).json({
        success: false,
        message: req.t("event.get.error.server"),
      });
    }
  }

  // Get events created by current user
  async getMyEvents(req, res) {
    try {
      req.query.created_by = req.user.id;
      return this.getEvents(req, res);
    } catch (error) {
      console.error("Error fetching user's events:", error);
      return res.status(500).json({
        success: false,
        message: req.t("event.get.error.server"),
      });
    }
  }

  // Get single event by ID with caching
  async getEventById(req, res) {
    try {
      const { id } = req.params;
      const cacheKey = `${CACHE_PREFIX}${id}`;
      const cachedEvent = await redisCacheInstance.get(cacheKey);

      if (cachedEvent) {
        return res.status(200).json({
          success: true,
          data: cachedEvent,
          fromCache: true,
        });
      }

      const event = await Event.getById(id);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: req.t("event.get.error.not_found"),
        });
      }

      await redisCacheInstance.set(cacheKey, event, CACHE_EXPIRATION);
      return res.status(200).json({
        success: true,
        message: req.t("event.get.success"),
        data: event,
      });
    } catch (error) {
      console.error("Error fetching event by ID:", error);
      return res.status(500).json({
        success: false,
        message: req.t("event.get.error.server"),
      });
    }
  }

  // Update event with change tracking and notifications
  async updateEvent(req, res) {
    try {
      const { id } = req.params;
      const validFields = [
        "title",
        "description",
        "address",
        "start_time",
        "end_time",
        "category",
        "longitude",
        "latitude",
        "ticket_price",
        "status",
      ];

      const eventData = {};
      validFields.forEach((field) => {
        if (req.body[field] !== undefined) eventData[field] = req.body[field];
      });

      const existingEvent = await Event.getById(id);
      if (!existingEvent) {
        return res.status(404).json({
          success: false,
          message: req.t("event.get.error.not_found"),
        });
      }

      if (
        req.user.role !== "admin" &&
        existingEvent.created_by !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: req.t("event.update.error.unauthorized"),
        });
      }

      const changedFields = [];
      if (eventData.title && eventData.title !== existingEvent.title)
        changedFields.push("title");
      if (
        eventData.description &&
        eventData.description !== existingEvent.description
      )
        changedFields.push("description");
      if (
        eventData.start_time &&
        eventData.start_time !== existingEvent.start_time
      )
        changedFields.push("time");
      if (eventData.address && eventData.address !== existingEvent.address)
        changedFields.push("location");

      const updatedEvent = await Event.update(id, eventData);

      if (changedFields.length > 0) {
        await notificationService.publishEventUpdate({
          id: updatedEvent.id,
          title: updatedEvent.title,
          category: updatedEvent.category,
          changes: changedFields.join(", "),
        });

        const creatorMessage = req.t("notification.event_update", {
          title: updatedEvent.title,
          changes: changedFields.join(", "),
        });

        await notificationService.sendDirectNotification(
          req.user.id,
          "EVENT_UPDATE",
          creatorMessage,
          updatedEvent.id
        );
      }

      if (
        eventData.start_time &&
        eventData.start_time !== existingEvent.start_time
      ) {
        await notificationService.scheduleEventReminder(updatedEvent);
      }

      await redisCacheInstance.delete(`${CACHE_PREFIX}${id}`);
      await redisCacheInstance.delete(`${CACHE_PREFIX}list:all:`);
      await redisCacheInstance.delete(
        `${CACHE_PREFIX}list:${existingEvent.category}:`
      );

      if (eventData.category && eventData.category !== existingEvent.category) {
        await redisCacheInstance.delete(
          `${CACHE_PREFIX}list:${eventData.category}:`
        );
      }

      return res.status(200).json({
        success: true,
        message: req.t("event.update.success"),
        data: updatedEvent,
      });
    } catch (error) {
      console.error("Error updating event:", error);
      return res.status(500).json({
        success: false,
        message: req.t("event.update.error.server"),
      });
    }
  }

  // Delete event with notifications and cache invalidation
  async deleteEvent(req, res) {
    try {
      const { id } = req.params;
      const existingEvent = await Event.getById(id);

      if (!existingEvent) {
        return res.status(404).json({
          success: false,
          message: req.t("event.get.error.not_found"),
        });
      }

      if (
        req.user.role !== "admin" &&
        existingEvent.created_by !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: req.t("event.delete.error.unauthorized"),
        });
      }

      await Event.delete(id);

      await notificationService.publishEventUpdate({
        id: existingEvent.id,
        title: existingEvent.title,
        category: existingEvent.category,
        changes: "cancelled",
      });

      const creatorMessage = req.t("notification.event_delete", {
        title: existingEvent.title,
      });

      await notificationService.sendDirectNotification(
        req.user.id,
        "EVENT_DELETE",
        creatorMessage,
        existingEvent.id
      );

      await redisCacheInstance.delete(`${CACHE_PREFIX}${id}`);
      await redisCacheInstance.delete(`${CACHE_PREFIX}list:all:`);
      await redisCacheInstance.delete(
        `${CACHE_PREFIX}list:${existingEvent.category}:`
      );

      return res.status(200).json({
        success: true,
        message: req.t("event.delete.success"),
      });
    } catch (error) {
      console.error("Error deleting event:", error);
      return res.status(500).json({
        success: false,
        message: req.t("event.delete.error.server"),
      });
    }
  }

  // Find nearby events with geospatial filtering
  async findEventsNearby(req, res) {
    try {
      let {
        latitude,
        longitude,
        radius = 10,
        category,
        startDate,
        endDate,
        limit = 20,
        offset = 0,
        name,
        address,
        created_by,
      } = req.query;
     
      if (filters.category && filters.category.trim() !== '') {
        query += ` AND category = $${paramPosition}`;
        values.push(filters.category.trim());
        paramPosition++;
      }

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: req.t("event.nearby.error.missing_coords"),
        });
      }

      const cacheKey = `${CACHE_PREFIX}nearby:${latitude}:${longitude}:${radius}:${
        name || ""
      }:${category || "all"}:${startDate || ""}:${endDate || ""}:${
        address || ""
      }:${created_by || ""}:${limit}:${offset}`;
      const cachedEvents = await redisCacheInstance.get(cacheKey);

      if (cachedEvents) {
        return res.status(200).json({
          success: true,
          data: cachedEvents,
          fromCache: true,
        });
      }

      const filters = {
        name,
        category,
        startDate,
        endDate,
        address,
        created_by,
        limit: parseInt(limit),
        offset: parseInt(offset),
      };

      const events = await Event.findNearby(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(radius),
        filters
      );

      const response = {
        success: true,
        message: req.t("event.nearby.success"),
        data: {
          events,
          center: {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
          },
          radius: parseFloat(radius),
          count: events.length,
        },
      };

      await redisCacheInstance.set(cacheKey, response.data, CACHE_EXPIRATION);
      return res.status(200).json(response);
    } catch (error) {
      console.error("Error finding nearby events:", error);
      return res.status(500).json({
        success: false,
        message: req.t("event.nearby.error.server"),
      });
    }
  }

  // Get all event categories with caching
  async getCategories(req, res) {
    try {
      const cacheKey = `${CACHE_PREFIX}categories`;
      const cachedCategories = await redisCacheInstance.get(cacheKey);

      if (cachedCategories) {
        return res.status(200).json({
          success: true,
          data: cachedCategories,
          fromCache: true,
        });
      }

      const categories = await Event.getCategories();
      await redisCacheInstance.set(cacheKey, categories, CACHE_EXPIRATION * 2);

      return res.status(200).json({
        success: true,
        message: req.t("event.categories.success"),
        data: categories,
      });
    } catch (error) {
      console.error("Error fetching event categories:", error);
      return res.status(500).json({
        success: false,
        message: req.t("event.categories.error.server"),
      });
    }
  }

  // Calculate distance between two geographic points
  async calculateDistance(req, res) {
    try {
      const { lat1, lon1, lat2, lon2 } = req.query;

      if (!lat1 || !lon1 || !lat2 || !lon2) {
        return res.status(400).json({
          success: false,
          message: req.t("event.distance.error.missing_coords"),
        });
      }

      const distance = await database.geo.calculateDistance(
        parseFloat(lat1),
        parseFloat(lon1),
        parseFloat(lat2),
        parseFloat(lon2)
      );

      return res.status(200).json({
        success: true,
        message: req.t("event.distance.success"),
        data: {
          distance_km: distance,
          distance_miles: distance * 0.621371,
        },
      });
    } catch (error) {
      console.error("Error calculating distance:", error);
      return res.status(500).json({
        success: false,
        message: req.t("event.distance.error.server"),
      });
    }
  }

  // clear all events from redis cache
  async clearAllEventCaches() {
    try {
      return await redisCacheInstance.deleteByPattern(`${CACHE_PREFIX}*`);
    } catch (error) {
      console.error("Error clearing all event caches:", error);
      return false;
    }
  }
}

module.exports = new EventController();
