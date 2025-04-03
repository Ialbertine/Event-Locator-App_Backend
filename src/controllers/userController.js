const jwt = require('jsonwebtoken');
const argon2 = require('argon2');
const User = require('../models/user');

const userController = {
  async register(req, res) {
    try {
      const location = {
        type: "Point",
        coordinates: [
          parseFloat(req.body.longitude),
          parseFloat(req.body.latitude)
        ]
      };
  
      const user = await User.create({
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phoneNumber: req.body.phoneNumber,
        location: location,
        preferredCategories: req.body.preferredCategories
      });
  
      const { password_hash, ...userResponse } = user;
  
      // IMPORTANT: Use req.t() for translation
      res.status(201).json({ 
        message: req.t('user.register.success'), // This will now translate properly
        user: userResponse 
      });
    } catch (error) {
      if (error.message === 'Username or email already exists') {
        return res.status(400).json({ 
          error: req.t('user.register.error.exists') 
        });
      }
      res.status(400).json({ 
        error: req.t('user.register.error.validation'),
        details: error.message
      });
    }
  },
  
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const user = await User.findByEmail(email);
      
      if (!user) {
        return res.status(401).json({ 
          error: req.t('user.login.error.invalid') 
        });
      }
      if (user.status === 'suspended') {
        return res.status(403).json({ 
          error: req.t('user.login.error.suspended') 
        });
      }
      if (!await argon2.verify(user.password_hash, password)) {
        return res.status(401).json({ 
          error: req.t('user.login.error.invalid') 
        });
      }
  
      const token = jwt.sign(
        { id: user.id, email: user.email, status: user.status },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
  
      const { password_hash, ...userResponse } = user;
  
      res.json({ 
        message: req.t('user.login.success'),
        user: userResponse, 
        token 
      });
    } catch (error) {
      next(error);
    }
  },
  

  async getProfile(req, res, next) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ 
          message: req.t('user.profile.not_found') 
        });
      }
      res.json(user);
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const updates = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phoneNumber: req.body.phoneNumber
      };
  
      if (req.body.longitude && req.body.latitude) {
        updates.location = {
          type: "Point",
          coordinates: [
            parseFloat(req.body.longitude),
            parseFloat(req.body.latitude)
          ]
        };
      }
  
      const updatedUser = await User.updateProfile(req.user.id, updates);
  
      if (!updatedUser) {
        return res.status(404).json({ 
          message: req.t('user.profile.not_found') 
        });
      }
  
      res.json({
        message: req.t('user.profile.update_success'),
        user: updatedUser
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteProfile(req, res, next) {
    try {
      const deleted = await User.deleteProfile(req.user.id);
      
      if (!deleted) {
        return res.status(404).json({ 
          message: req.t('user.profile.not_found') 
        });
      }
  
      res.json({ 
        message: req.t('user.profile.delete_success')
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = userController;