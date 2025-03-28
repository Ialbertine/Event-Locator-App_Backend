const jwt = require('jsonwebtoken');
const argon2 = require('argon2');
const User = require('../models/user');

const userController = {
    async register(req, res) {
        try {
            // Convert location data to proper format
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
                language: req.body.language,
                location: location,
                preferredCategories: req.body.preferredCategories
            });

            // Remove sensitive data from response
            const { password_hash, ...userResponse } = user;

            res.status(201).json({ 
                message: 'User registered successfully',
                user: userResponse 
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const user = await User.findByEmail(email);
            
            if (!user) return res.status(401).json({ error: 'Invalid credentials' });
            if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' });
            if (!await argon2.verify(user.password_hash, password)) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = jwt.sign(
                { id: user.id, email: user.email, status: user.status },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            // Remove sensitive data from response
            const { password_hash, ...userResponse } = user;

            res.json({ user: userResponse, token });
        } catch (error) {
            next(error);
        }
    },

    async getProfile(req, res, next) {
        try {
            const user = await User.findById(req.user.id);
            if (!user) return res.status(404).json({ message: 'User not found' });
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
                phoneNumber: req.body.phoneNumber,
                language: req.body.language
            };

            // Add location if provided
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
                return res.status(404).json({ message: 'User not found' });
            }

            res.json({
                message: 'Profile updated successfully',
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
                return res.status(404).json({ message: 'User not found' });
            }

            res.json({ 
                message: 'Profile deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = userController;