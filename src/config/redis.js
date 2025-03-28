// Redis Configuration for Pub/Sub and Caching
const Redis = require('redis');
const dotenv = require('dotenv');

dotenv.config();

// Redis Configuration with Advanced Options
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    
    // Connection Retry Strategy
    retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
            return new Error('Redis server refused connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Retry time exhausted');
        }
        return Math.min(options.attempt * 100, 3000);
    }
};

// Create Redis Clients
const publisher = Redis.createClient(redisConfig);
const subscriber = Redis.createClient(redisConfig);
const cache = Redis.createClient(redisConfig);

// Error Handling
publisher.on('error', (err) => console.error('Redis Publisher Error:', err));
subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));
cache.on('error', (err) => console.error('Redis Cache Error:', err));

// Pub/Sub Communication Helper
class RedisPubSub {
    constructor(pub, sub) {
        this.publisher = pub;
        this.subscriber = sub;
    }

    // Publish a message to a channel
    async publish(channel, message) {
        return new Promise((resolve, reject) => {
            this.publisher.publish(channel, JSON.stringify(message), (err, reply) => {
                if (err) reject(err);
                else resolve(reply);
            });
        });
    }

    // Subscribe to a channel
    subscribe(channel, callback) {
        this.subscriber.subscribe(channel);
        this.subscriber.on('message', (subscribedChannel, message) => {
            if (subscribedChannel === channel) {
                callback(JSON.parse(message));
            }
        });
    }
}

// Caching Helper with Expiration
class RedisCache {
    constructor(client) {
        this.client = client;
    }

    // Set a cached value with optional expiration
    async set(key, value, expirationSeconds = 3600) {
        return new Promise((resolve, reject) => {
            this.client.setex(key, expirationSeconds, JSON.stringify(value), (err, reply) => {
                if (err) reject(err);
                else resolve(reply);
            });
        });
    }

    // Get a cached value
    async get(key) {
        return new Promise((resolve, reject) => {
            this.client.get(key, (err, reply) => {
                if (err) reject(err);
                else resolve(reply ? JSON.parse(reply) : null);
            });
        });
    }

    // Delete a cached value
    async delete(key) {
        return new Promise((resolve, reject) => {
            this.client.del(key, (err, reply) => {
                if (err) reject(err);
                else resolve(reply);
            });
        });
    }
}

// Connect to Redis
async function connectRedis() {
    await Promise.all([
        publisher.connect(),
        subscriber.connect(),
        cache.connect()
    ]);
    console.log('Redis connections established');
}

module.exports = {
    publisher,
    subscriber,
    cache,
    RedisPubSub: new RedisPubSub(publisher, subscriber),
    RedisCache: new RedisCache(cache),
    connectRedis
};