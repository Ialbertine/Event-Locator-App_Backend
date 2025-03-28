const jwt = require('jsonwebtoken');
const { LanguageUtils } = require('../config/i18n');
const { RedisCache } = require('../config/redis');

class auth {
    constructor() {
        this.cache = new RedisCache();
    }

    /**
     * Verify JWT token and attach user to request
     */
    authenticate = async (req, res, next) => {
        try {
            // 1. Check for token in headers
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    success: false,
                    message: LanguageUtils.translate('error.unauthorized')
                });
            }

            const token = authHeader.split(' ')[1];
            
            // 2. Check token in blacklist cache
            const isBlacklisted = await this.cache.get(`blacklist:${token}`);
            if (isBlacklisted) {
                return res.status(401).json({
                    success: false,
                    message: LanguageUtils.translate('error.token_revoked')
                });
            }

            // 3. Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // 4. Attach user to request
            req.user = {
                id: decoded.id,
                email: decoded.email,
                status: decoded.status,
                role: decoded.role || 'user' // Default role if not specified
            };

            next();
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: LanguageUtils.translate('error.token_expired')
                });
            }
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    message: LanguageUtils.translate('error.invalid_token')
                });
            }
            next(error);
        }
    };

    /**
     * Role-based access control
     */
    authorize = (roles = []) => {
        if (typeof roles === 'string') {
            roles = [roles];
        }

        return (req, res, next) => {
            if (roles.length && !roles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: LanguageUtils.translate('error.forbidden')
                });
            }
            next();
        };
    };

    /**
     * Check if user account is active
     */
    checkAccountStatus = (req, res, next) => {
        if (req.user.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: LanguageUtils.translate('error.account_inactive')
            });
        }
        next();
    };

    /**
     * Token blacklisting for logout
     */
    blacklistToken = async (req, res, next) => {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return next();
            
            // Add token to blacklist with expiration matching token's remaining time
            const decoded = jwt.decode(token);
            const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
            
            if (expiresIn > 0) {
                await this.cache.set(`blacklist:${token}`, 'true', expiresIn);
            }
            
            next();
        } catch (error) {
            next(error);
        }
    };
}

module.exports = new auth();