const Redis = require('redis');
require('dotenv').config();

let isRedisConnected = false;

// Redis Configuration
const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  },
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('Redis server refused connection');
    }
    return Math.min(options.attempt * 100, 5000);
  }
};

// Create Redis Clients
const publisher = Redis.createClient(redisConfig);
const subscriber = Redis.createClient(redisConfig);
const cache = Redis.createClient(redisConfig);

// Event Handlers
function setupClientEvents(client, name) {
  client.on('connect', () => console.log(`${name} Redis connecting`));
  client.on('ready', () => {
    console.log(`${name} Redis ready`);
    isRedisConnected = true;
  });
  client.on('error', (err) => console.error(`${name} Redis error:`, err));
  client.on('reconnecting', () => console.log(`${name} Redis reconnecting`));
  client.on('end', () => {
    console.log(`${name} Redis disconnected`);
    isRedisConnected = false;
  });
}

setupClientEvents(publisher, 'Publisher');
setupClientEvents(subscriber, 'Subscriber');
setupClientEvents(cache, 'Cache');

// Redis Cache Class
class RedisCache {
  constructor(client) {
    this.client = client;
  }

  async ensureConnected() {
    try {
      await this.client.ping();
      return true;
    } catch (err) {
      console.error('Redis connection check failed:', err);
      return false;
    }
  }

  async get(key) {
    if (!isRedisConnected) return null;
    try {
      const reply = await this.client.get(key);
      if (reply) {
        await this.client.incr('cache:hits');
        return JSON.parse(reply);
      }
      await this.client.incr('cache:misses');
      return null;
    } catch (err) {
      console.error('Redis GET error:', err);
      return null;
    }
  }

  async set(key, value, expirationSeconds = 3600) {
    if (!isRedisConnected) return false;
    try {
      await this.client.setEx(key, expirationSeconds, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('Redis SET error:', err);
      return false;
    }
  }

  async delete(key) {
    if (!isRedisConnected) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (err) {
      console.error('Redis DEL error:', err);
      return false;
    }
  }

  async deleteByPattern(pattern) {
    if (!isRedisConnected) return false;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (err) {
      console.error('Redis DEL pattern error:', err);
      return false;
    }
  }

  async getStats() {
    if (!isRedisConnected) return null;
    try {
      return {
        hits: await this.client.get('cache:hits') || 0,
        misses: await this.client.get('cache:misses') || 0,
        size: await this.client.dbsize(),
        connected: isRedisConnected
      };
    } catch (err) {
      console.error('Redis stats error:', err);
      return null;
    }
  }

  async flushAll() {
    if (!isRedisConnected) return false;
    try {
      await this.client.flushAll();
      return true;
    } catch (err) {
      console.error('Redis FLUSHALL error:', err);
      return false;
    }
  }
}

// Initialize connections
async function connectRedis() {
  try {
    await Promise.all([
      publisher.connect(),
      subscriber.connect(),
      cache.connect()
    ]);
    console.log('All Redis connections established');
    return true;
  } catch (err) {
    console.error('Redis connection failed:', err);
    throw err;
  }
}

// Singleton instance
const redisCacheInstance = new RedisCache(cache);

module.exports = {
  publisher,
  subscriber,
  cache,
  redisCacheInstance,
  connectRedis,
  isRedisConnected
};