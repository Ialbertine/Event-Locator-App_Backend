const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const userController = require('../controllers/userController');
const { validationSchemas } = require('../middlewares/validate');

// Public routes
router.post('/register', validationSchemas.register, userController.register);
router.post('/login', validationSchemas.login, userController.login);

router.get('/profile', auth.authenticate, userController.getProfile);
router.put('/update-profile', auth.authenticate, userController.updateProfile);
router.delete('/delete-profile', auth.authenticate, userController.deleteProfile);

module.exports = router;