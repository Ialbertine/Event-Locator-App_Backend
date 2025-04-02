const { Pool } = require('pg');
const pgPromise = require('pg-promise');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Database Configuration Options
const dbConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    
    max: 20,         
    idleTimeoutMillis: 30000, 
    connectionTimeoutMillis: 2000, 
    
    // PostGIS and Geospatial 
    ssl: false
};

// Create PostgreSQL Connection Pool
const pool = new Pool(dbConfig);

// Enhanced Error Handling for Database Connections
pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error', err);
    process.exit(-1);
});

// Geospatial Query 
class GeoDatabaseHelper {
    constructor(connection) {
        this.connection = connection;
    }

    // Method to calculate distance between two geographic points
    async calculateDistance(lat1, lon1, lat2, lon2) {
        const query = `
            SELECT ST_DistanceSphere(
                ST_MakePoint($1, $2),
                ST_MakePoint($3, $4)
            ) / 1000 AS distance_km
        `;
        const result = await this.connection.one(query, [lon1, lat1, lon2, lat2]);
        return result.distance_km;
    }

    // Find events within a specific radius
    async findEventsNearby(latitude, longitude, radiusKm, createdBy = null) {
        let query = `
            SELECT 
                id, name, description, 
                ST_X(location::geometry) as longitude,
                ST_Y(location::geometry) as latitude,
                created_by,
                ST_DistanceSphere(
                    location, 
                    ST_MakePoint($1, $2)
                ) / 1000 as distance
            FROM events
            WHERE ST_DWithin(
                location::geography, 
                ST_MakePoint($1, $2)::geography, 
                $3 * 1000
            )
            AND status != 'cancelled'
        `;
        
        const params = [longitude, latitude, radiusKm];
        
        // Add filter for created_by if provided
        if (createdBy) {
            query += ` AND created_by = $4`;
            params.push(createdBy);
        }
        
        query += ` ORDER BY distance`;
        
        return this.connection.any(query, params);
    }
}

// Centralized Database Initialization
async function initializeDatabase() {
    try {
        // Enable PostGIS Extension
        await pool.query('CREATE EXTENSION IF NOT EXISTS postgis');
        
        // Create Users Table with Geospatial Column
        await pool.query(`
          CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY,
              username VARCHAR(50) UNIQUE NOT NULL,
              email VARCHAR(100) UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              first_name VARCHAR(50) NOT NULL,
              last_name VARCHAR(50) NOT NULL,
              phone_number VARCHAR(20),
              language VARCHAR(10) DEFAULT 'en',
              status VARCHAR(20) DEFAULT 'active',
              role VARCHAR(20) NOT NULL DEFAULT 'user',
              location GEOGRAPHY(Point, 4326),
              preferred_categories TEXT[] DEFAULT '{}',
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
          )
      `);

        // Create Events Table with Geospatial Indexing and created_by reference
        await pool.query(`
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                title VARCHAR(100) NOT NULL,
                description TEXT,
                location GEOGRAPHY(Point, 4326),
                address TEXT NOT NULL,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP NOT NULL,
                category VARCHAR(50) NOT NULL,
                created_by INTEGER REFERENCES users(id) NOT NULL,
                ticket_price DECIMAL(10, 2) DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'cancelled', 'completed')),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Create Spatial Index for Performance
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_events_location 
            ON events USING GIST(location)
        `);
        
        // Create Index for created_by for faster owner-based queries
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_events_created_by
            ON events(created_by)
        `);

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
}

// Database Connection Wrapper
const pgp = pgPromise(); 

// Connect pg-promise with dbConfig
const database = pgp(dbConfig);

// Extend database with Geospatial Helper
database.geo = new GeoDatabaseHelper(database);

module.exports = {
    pool,
    database,
    initializeDatabase,
    GeoDatabaseHelper
};