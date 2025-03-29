const Event = require('../models/event');
const { LanguageUtils } = require('../config/i18n');
const { redisCacheInstance } = require('../config/redis');
const { database } = require('../config/db');

// Cache configuration
const CACHE_EXPIRATION = 60 * 15; // 15 minutes
const CACHE_PREFIX = 'event:';

class EventController {
    // Create a new event
    async createEvent(req, res) {
        try {
            const eventData = {
                ...req.body,
                created_by: req.user.id // Get user ID from authenticated request
            };

            // Validate required fields
            const requiredFields = ['title', 'address', 'start_time', 'end_time', 'category', 'longitude', 'latitude'];
            const missingFields = requiredFields.filter(field => !eventData[field]);

            if (missingFields.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Missing required fields: ${missingFields.join(', ')}`
                });
            }

            // Create the event
            const newEvent = await Event.create(eventData);

            // Invalidate relevant caches
            await redisCacheInstance.delete(`${CACHE_PREFIX}categories`);
            
            // Response with success message in preferred language
            return res.status(201).json({
                success: true,
                message: LanguageUtils.translate('events.created'),
                data: newEvent
            });
        } catch (error) {
            console.error('Error creating event:', error);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get all events with filtering
    async getEvents(req, res) {
        try {
            const {
                category,
                startDate,
                endDate,
                limit = 20,
                offset = 0,
                created_by
            } = req.query;

            // Build cache key based on request parameters
            const cacheKey = `${CACHE_PREFIX}list:${category || 'all'}:${startDate || ''}:${endDate || ''}:${limit}:${offset}:${created_by || ''}`;
            
            // Try to get from cache first
            const cachedEvents = await redisCacheInstance.get(cacheKey);
            if (cachedEvents) {
                return res.status(200).json({
                    success: true,
                    data: cachedEvents,
                    fromCache: true
                });
            }

            // Build filters
            const filters = {
                category,
                startDate,
                endDate,
                limit: parseInt(limit),
                offset: parseInt(offset),
                createdBy: created_by
            };

            // Get events with filters
            const events = await Event.getAll(filters);
            const total = await Event.count({ category, startDate, endDate, createdBy: created_by });

            const response = {
                success: true,
                data: {
                    events,
                    pagination: {
                        total,
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        hasMore: total > (parseInt(offset) + parseInt(limit))
                    }
                }
            };

            // Cache the response
            await redisCacheInstance.set(cacheKey, response.data, CACHE_EXPIRATION);

            return res.status(200).json(response);
        } catch (error) {
            console.error('Error fetching events:', error);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get a single event by ID
    async getEventById(req, res) {
        try {
            const { id } = req.params;
            
            // Try to get from cache first
            const cacheKey = `${CACHE_PREFIX}${id}`;
            const cachedEvent = await redisCacheInstance.get(cacheKey);
            
            if (cachedEvent) {
                return res.status(200).json({
                    success: true,
                    data: cachedEvent,
                    fromCache: true
                });
            }

            // Get event from database
            const event = await Event.getById(id);
            
            if (!event) {
                return res.status(404).json({
                    success: false,
                    message: LanguageUtils.translate('events.notFound')
                });
            }

            // Cache the event
            await redisCacheInstance.set(cacheKey, event, CACHE_EXPIRATION);

            return res.status(200).json({
                success: true,
                data: event
            });
        } catch (error) {
            console.error('Error fetching event by ID:', error);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Update an event
    async updateEvent(req, res) {
        try {
            const { id } = req.params;
            const eventData = req.body;
            
            // Get the current event
            const existingEvent = await Event.getById(id);
            
            if (!existingEvent) {
                return res.status(404).json({
                    success: false,
                    message: LanguageUtils.translate('events.notFound')
                });
            }
            
            // Check if user is authorized to update the event
            if (existingEvent.created_by !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: LanguageUtils.translate('events.unauthorized')
                });
            }

            // Update the event
            const updatedEvent = await Event.update(id, eventData);

            // Invalidate cache
            await redisCacheInstance.delete(`${CACHE_PREFIX}${id}`);
            
            // Invalidate list caches - we'll use a pattern delete if Redis supports it
            // or manually delete common cache combinations
            await redisCacheInstance.delete(`${CACHE_PREFIX}list:all:`);
            await redisCacheInstance.delete(`${CACHE_PREFIX}list:${existingEvent.category}:`);
            if (eventData.category && eventData.category !== existingEvent.category) {
                await redisCacheInstance.delete(`${CACHE_PREFIX}list:${eventData.category}:`);
            }

            return res.status(200).json({
                success: true,
                message: LanguageUtils.translate('events.updated'),
                data: updatedEvent
            });
        } catch (error) {
            console.error('Error updating event:', error);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Delete an event
    async deleteEvent(req, res) {
        try {
            const { id } = req.params;
            
            // Get the current event
            const existingEvent = await Event.getById(id);
            
            if (!existingEvent) {
                return res.status(404).json({
                    success: false,
                    message: LanguageUtils.translate('events.notFound')
                });
            }
            
            // Check if user is authorized to delete the event
            if (existingEvent.created_by !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: LanguageUtils.translate('events.unauthorized')
                });
            }

            // Delete (soft delete) the event
            const result = await Event.delete(id);

            // Invalidate cache
            await redisCacheInstance.delete(`${CACHE_PREFIX}${id}`);
            
            // Invalidate list caches
            await redisCacheInstance.delete(`${CACHE_PREFIX}list:all:`);
            await redisCacheInstance.delete(`${CACHE_PREFIX}list:${existingEvent.category}:`);

            return res.status(200).json({
                success: true,
                message: LanguageUtils.translate('events.deleted')
            });
        } catch (error) {
            console.error('Error deleting event:', error);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Find events nearby a location
    async findEventsNearby(req, res) {
        try {
            const { latitude, longitude, radius = 10, category, startDate, endDate, limit = 20, offset = 0 } = req.query;
            
            // Validate location parameters
            if (!latitude || !longitude) {
                return res.status(400).json({
                    success: false,
                    message: 'Latitude and longitude are required'
                });
            }
            
            // Build cache key
            const cacheKey = `${CACHE_PREFIX}nearby:${latitude}:${longitude}:${radius}:${category || 'all'}:${startDate || ''}:${endDate || ''}:${limit}:${offset}`;
            
            // Try to get from cache
            const cachedEvents = await redisCacheInstance.get(cacheKey);
            if (cachedEvents) {
                return res.status(200).json({
                    success: true,
                    data: cachedEvents,
                    fromCache: true
                });
            }

            // Use our geospatial helper to find nearby events
            const filters = {
                category,
                startDate,
                endDate,
                limit: parseInt(limit),
                offset: parseInt(offset)
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
                        longitude: parseFloat(longitude)
                    },
                    radius: parseFloat(radius),
                    count: events.length
                }
            };

            // Cache the results
            await redisCacheInstance.set(cacheKey, response.data, CACHE_EXPIRATION);

            return res.status(200).json(response);
        } catch (error) {
            console.error('Error finding nearby events:', error);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get all event categories
    async getCategories(req, res) {
        try {
            // Try to get from cache
            const cacheKey = `${CACHE_PREFIX}categories`;
            const cachedCategories = await redisCacheInstance.get(cacheKey);
            
            if (cachedCategories) {
                return res.status(200).json({
                    success: true,
                    data: cachedCategories,
                    fromCache: true
                });
            }

            // Get categories from database
            const categories = await Event.getCategories();

            // Cache the results
            await redisCacheInstance.set(cacheKey, categories, CACHE_EXPIRATION * 2); // Longer expiration for categories

            return res.status(200).json({
                success: true,
                data: categories
            });
        } catch (error) {
            console.error('Error fetching event categories:', error);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Calculate distance between two points
    async calculateDistance(req, res) {
        try {
            const { lat1, lon1, lat2, lon2 } = req.query;
            
            // Validate parameters
            if (!lat1 || !lon1 || !lat2 || !lon2) {
                return res.status(400).json({
                    success: false,
                    message: 'All coordinates (lat1, lon1, lat2, lon2) are required'
                });
            }

            // Use pg-promise for this specific calculation
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
                    distance_miles: distance * 0.621371
                }
            });
        } catch (error) {
            console.error('Error calculating distance:', error);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new EventController();