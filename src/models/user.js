const { pool, database } = require('../config/db');
const argon2 = require('argon2');


class User {
    static async create({
        username,
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        language = 'en',
        location, 
        preferredCategories = []
    }) {
        const passwordHash = await argon2.hash(password);
        const query = `
            INSERT INTO users (
                username, email, password_hash, first_name, last_name,
                phone_number, language, location, preferred_categories
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326), $10)
            RETURNING 
                id, username, email, first_name, last_name, phone_number,
                language, preferred_categories, status,
                ST_AsGeoJSON(location) as location,
                created_at
        `;
        
        try {
            const result = await pool.query(query, [
                username, email, passwordHash, firstName, lastName,
                phoneNumber, language, 
                location.coordinates[0], // longitude
                location.coordinates[1], // latitude
                preferredCategories
            ]);
            
            // Convert the returned location to proper GeoJSON
            const user = result.rows[0];
            if (user.location) {
                user.location = JSON.parse(user.location);
            }
            return user;
        } catch (error) {
            if (error.code === '23505') {
                throw new Error('Username or email already exists');
            }
            throw error;
        }
    }

    static async findByEmail(email) {
        const query = `
            SELECT 
                id, username, email, password_hash, first_name, last_name,
                phone_number, language, status, preferred_categories,
                ST_AsGeoJSON(location) as location
            FROM users
            WHERE email = $1 AND status != 'deleted'
        `;
        const result = await pool.query(query, [email]);
        if (result.rows[0] && result.rows[0].location) {
            result.rows[0].location = JSON.parse(result.rows[0].location);
        }
        return result.rows[0] || null;
    }

    static async findById(id) {
        const query = `
            SELECT 
                id, username, email, first_name, last_name, phone_number,
                language, status, preferred_categories,
                ST_AsGeoJSON(location) as location,
                created_at, updated_at
            FROM users
            WHERE id = $1 AND status != 'deleted'
        `;
        const result = await pool.query(query, [id]);
        if (result.rows[0] && result.rows[0].location) {
            result.rows[0].location = JSON.parse(result.rows[0].location);
        }
        return result.rows[0] || null;
    }

    static async updateProfile(id, updates) {
        const {
            firstName,
            lastName,
            phoneNumber,
            language,
            location
        } = updates;

        const setClauses = [];
        const values = [id];
        let paramIndex = 2;

        if (firstName !== undefined) {
            setClauses.push(`first_name = $${paramIndex}`);
            values.push(firstName);
            paramIndex++;
        }

        if (lastName !== undefined) {
            setClauses.push(`last_name = $${paramIndex}`);
            values.push(lastName);
            paramIndex++;
        }

        if (phoneNumber !== undefined) {
            setClauses.push(`phone_number = $${paramIndex}`);
            values.push(phoneNumber);
            paramIndex++;
        }

        if (language !== undefined) {
            setClauses.push(`language = $${paramIndex}`);
            values.push(language);
            paramIndex++;
        }

        if (location !== undefined) {
            setClauses.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)`);
            values.push(location.coordinates[0], location.coordinates[1]);
            paramIndex += 2;
        }

        if (setClauses.length === 0) {
            throw new Error('No valid fields to update');
        }

        setClauses.push('updated_at = NOW()');

        const query = `
            UPDATE users
            SET ${setClauses.join(', ')}
            WHERE id = $1
            RETURNING 
                id, username, email, first_name, last_name, phone_number,
                language, status, preferred_categories,
                ST_AsGeoJSON(location) as location,
                updated_at
        `;

        const result = await pool.query(query, values);
        if (result.rows[0] && result.rows[0].location) {
            result.rows[0].location = JSON.parse(result.rows[0].location);
        }
        return result.rows[0];
    }

    static async deleteProfile(id) {
        // Soft delete implementation
        const query = `
            UPDATE users
            SET status = 'deleted', updated_at = NOW()
            WHERE id = $1
            RETURNING id
        `;
        const result = await pool.query(query, [id]);
        return result.rowCount > 0;
    }

    // Additional methods using pg-promise for more complex queries
    static async findNearbyUsers(latitude, longitude, radiusKm) {
        return database.geo.findEventsNearby(latitude, longitude, radiusKm)
            .then(events => events)
            .catch(error => {
                console.error('Error finding nearby users:', error);
                throw error;
            });
    }
}

module.exports = User;