const jwt = require('jsonwebtoken');
const { redisCacheInstance } = require('../config/redis');

class Auth {
  constructor() {
    this.cache = redisCacheInstance;
  }

  authenticate = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: req.t('errors.auth.no_header')
        });
      }
  
      const [scheme, token] = authHeader.split(' ');
      if (!scheme || !token || !/^Bearer$/i.test(scheme)) {
        return res.status(401).json({
          success: false,
          message: req.t('errors.auth.invalid_format')
        });
      }
  
      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET missing');
        return res.status(500).json({
          success: false,
          message: req.t('errors.server')
        });
      }
  
      const isBlacklisted = await this.cache.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({
          success: false,
          message: req.t('errors.auth.token_revoked')
        });
      }
  
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(401).json({
        success: false,
        message: req.t('errors.auth.failed'),
        error: error.message
      });
    }
  };

  authorize = (roles = []) => {
    if (typeof roles === 'string') roles = [roles];
    
    return (req, res, next) => {
      if (roles.length && !roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: req.t('errors.auth.insufficient_permissions')
        });
      }
      next();
    };
  };

  blacklistToken = async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return next();

      const decoded = jwt.decode(token);
      if (decoded?.exp) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          await this.cache.set(`blacklist:${token}`, 'true', expiresIn);
        }
      }
      next();
    } catch (error) {
      console.error('Token blacklist error:', error);
      next(error);
    }
  };
}

module.exports = new Auth();