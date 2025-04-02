const Event = require("../models/event");
const { LanguageUtils } = require("../config/i18n");
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
          message: `Missing required fields: ${missingFields.join(", ")}`,
        });
      }

      eventData.created_by = req.user.id;
      const newEvent = await Event.create(eventData);

      await notificationService.scheduleEventReminder(newEvent);
      await redisCacheInstance.delete(`${CACHE_PREFIX}categories`);

      return res.status(201).json({
        success: true,
        message: LanguageUtils.translate("events.created"),
        data: newEvent,
      });
    } catch (error) {
      console.error("Error creating event:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
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
      if (category) category = category.trim();

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
        message: error.message,
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
        message: error.message,
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
          message: LanguageUtils.translate("events.notFound"),
        });
      }

      await redisCacheInstance.set(cacheKey, event, CACHE_EXPIRATION);
      return res.status(200).json({
        success: true,
        data: event,
      });
    } catch (error) {
      console.error("Error fetching event by ID:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
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
          message: LanguageUtils.translate("events.notFound"),
        });
      }

      if (
        req.user.role !== "admin" &&
        existingEvent.created_by !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: LanguageUtils.translate("events.unauthorized"),
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

        const creatorMessage = LanguageUtils.translate(
          "events.creatorUpdate",
          {
            title: updatedEvent.title,
            changes: changedFields.join(", "),
          },
          { lng: req.language }
        );

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
        message: LanguageUtils.translate("events.updated"),
        data: updatedEvent,
      });
    } catch (error) {
      console.error("Error updating event:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
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
          message: LanguageUtils.translate("events.notFound"),
        });
      }

      if (
        req.user.role !== "admin" &&
        existingEvent.created_by !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: LanguageUtils.translate("events.unauthorized"),
        });
      }

      await Event.delete(id);

      await notificationService.publishEventUpdate({
        id: existingEvent.id,
        title: existingEvent.title,
        category: existingEvent.category,
        changes: "cancelled",
      });

      const creatorMessage = LanguageUtils.translate(
        "events.creatorDelete",
        {
          title: existingEvent.title,
        },
        { lng: req.language }
      );

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
        message: LanguageUtils.translate("events.deleted"),
      });
    } catch (error) {
      console.error("Error deleting event:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
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
      if (category) category = category.trim();

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: "Latitude and longitude are required",
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
        message: error.message,
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
        data: categories,
      });
    } catch (error) {
      console.error("Error fetching event categories:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
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
          message: "All coordinates (lat1, lon1, lat2, lon2) are required",
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
        data: {
          distance_km: distance,
          distance_miles: distance * 0.621371,
        },
      });
    } catch (error) {
      console.error("Error calculating distance:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new EventController();
