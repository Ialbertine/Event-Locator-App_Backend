const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const Auth = require('../middlewares/auth');

// Event management routes
router.post(
    '/',
    Auth.authenticate,
    eventController.createEvent
);

router.get(
    '/',
    eventController.getEvents
);

router.get(
    '/categories',
    eventController.getCategories
);

router.get(
    '/nearby',
    eventController.findEventsNearby
);

router.get(
    '/distance',
    eventController.calculateDistance
);

router.get(
    '/:id',
    eventController.getEventById
);

router.put(
    '/:id',
    Auth.authenticate,
    eventController.updateEvent
);

router.delete(
    '/:id',
    Auth.authenticate,
    eventController.deleteEvent
);

module.exports = router;