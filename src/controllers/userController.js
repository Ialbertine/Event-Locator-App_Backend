const jwt = require('jsonwebtoken');
const User = require('../models/user');

const userController = {
    /**
     * Register a new user
     */
    async register(req, res, next) {
        try {
            const user = await User.create(req.body);
            res.status(201).json(user);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Authenticate user and return JWT token
     */
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            
            // Get user with password hash
            const user = await User.findByEmail(email);
            if (!user) {
                throw new Error('Invalid credentials');
            }
            
            if (user.status === 'suspended') {
                throw new Error('Account suspended. Contact support.');
            }

            const validPassword = await argon2.verify(user.password_hash, password);
            if (!validPassword) {
                throw new Error('Invalid credentials');
            }

            const token = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    status: user.status
                },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.json({
                id: user.id,
                username: user.username,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phoneNumber: user.phone_number,
                language: user.language,
                preferredCategories: user.preferred_categories,
                latitude: user.latitude,
                longitude: user.longitude,
                status: user.status,
                token
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get current user profile
     */
    async getProfile(req, res, next) {
        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            res.json(user);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update user profile
     */
    async updateProfile(req, res, next) {
        try {
            const updatedUser = await User.updateProfile(req.user.id, req.body);
            res.json(updatedUser);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update user preferences
     */
    async updatePreferences(req, res, next) {
        try {
            const updatedUser = await User.updatePreferences(req.user.id, req.body);
            res.json(updatedUser);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Change user password
     */
    async changePassword(req, res, next) {
        try {
            const { currentPassword, newPassword } = req.body;
            const success = await User.changePassword(
                req.user.id,
                currentPassword,
                newPassword
            );
            
            if (success) {
                res.json({ message: 'Password changed successfully' });
            } else {
                res.status(400).json({ message: 'Failed to change password' });
            }
        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete user account (soft delete)
     */
    async deleteAccount(req, res, next) {
        try {
            const success = await User.updateStatus(req.user.id, 'deleted');
            if (success) {
                res.json({ message: 'Account deleted successfully' });
            } else {
                res.status(400).json({ message: 'Failed to delete account' });
            }
        } catch (error) {
            next(error);
        }
    }
};

module.exports = userController;