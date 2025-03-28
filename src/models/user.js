const { pool } = require('../db');
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
        latitude,
        longitude,
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
                ST_Y(location::geometry) as latitude,
                ST_X(location::geometry) as longitude,
                created_at
        `;
        
        try {
            const result = await pool.query(query, [
                username, email, passwordHash, firstName, lastName,
                phoneNumber, language, longitude, latitude, preferredCategories
            ]);
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') {
                throw new Error('Username or email already exists');
            }
            throw error;
        }
    }

  // Get user by email for authentication
    static async findByEmail(email) {
        const query = `
            SELECT 
                id, username, email, password_hash, first_name, last_name,
                phone_number, language, status, preferred_categories,
                ST_Y(location::geometry) as latitude,
                ST_X(location::geometry) as longitude
            FROM users
            WHERE email = $1 AND status != 'deleted'
        `;
        const result = await pool.query(query, [email]);
        return result.rows[0] || null;
    }

  //  Get user by ID
    static async findById(id) {
        const query = `
            SELECT 
                id, username, email, first_name, last_name, phone_number,
                language, status, preferred_categories,
                ST_Y(location::geometry) as latitude,
                ST_X(location::geometry) as longitude,
                created_at, updated_at
            FROM users
            WHERE id = $1 AND status != 'deleted'
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }

  // Update user profile
    static async updateProfile(id, updates) {
        const {
            firstName,
            lastName,
            phoneNumber,
            language,
            latitude,
            longitude
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

        if (latitude !== undefined && longitude !== undefined) {
            setClauses.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)`);
            values.push(longitude, latitude);
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
                language, status,
                ST_Y(location::geometry) as latitude,
                ST_X(location::geometry) as longitude,
                updated_at
        `;

        const result = await pool.query(query, values);
        return result.rows[0];
    }

  // Update user preferences
    static async updatePreferences(id, { latitude, longitude, preferredCategories }) {
        const setClauses = [];
        const values = [id];
        let paramIndex = 2;

        if (latitude !== undefined && longitude !== undefined) {
            setClauses.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)`);
            values.push(longitude, latitude);
            paramIndex += 2;
        }

        if (preferredCategories !== undefined) {
            setClauses.push(`preferred_categories = $${paramIndex}`);
            values.push(preferredCategories);
            paramIndex++;
        }

        if (setClauses.length === 0) {
            throw new Error('No preferences to update');
        }

        setClauses.push('updated_at = NOW()');

        const query = `
            UPDATE users
            SET ${setClauses.join(', ')}
            WHERE id = $1
            RETURNING 
                id, preferred_categories,
                ST_Y(location::geometry) as latitude,
                ST_X(location::geometry) as longitude,
                updated_at
        `;

        const result = await pool.query(query, values);
        return result.rows[0];
    }

  // Update user account status
    static async updateStatus(id, status) {
        const validStatuses = ['active', 'suspended', 'deleted'];
        if (!validStatuses.includes(status)) {
            throw new Error('Invalid status value');
        }

        const query = `
            UPDATE users
            SET status = $2, updated_at = NOW()
            WHERE id = $1
        `;
        const result = await pool.query(query, [id, status]);
        return result.rowCount > 0;
    }

  // Change user password
    static async changePassword(id, currentPassword, newPassword) {
        // First verify current password
        const userQuery = 'SELECT password_hash FROM users WHERE id = $1';
        const userResult = await pool.query(userQuery, [id]);
        
        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }

        const validPassword = await argon2.verify(
            userResult.rows[0].password_hash,
            currentPassword
        );
        
        if (!validPassword) {
            throw new Error('Current password is incorrect');
        }

        // Update to new password
        const newHash = await argon2.hash(newPassword);
        const updateQuery = `
            UPDATE users
            SET password_hash = $2, updated_at = NOW()
            WHERE id = $1
        `;
        const updateResult = await pool.query(updateQuery, [id, newHash]);
        return updateResult.rowCount > 0;
    }
}

module.exports = User;