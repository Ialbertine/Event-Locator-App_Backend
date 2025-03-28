const { pool } = require('../db');

class Event {
    static async create({ 
        title, description, latitude, longitude, address, 
        startTime, endTime, category, createdBy, ticketPrice = 0 
    }) {
        const query = `
            INSERT INTO events (
                title, description, location, address, 
                start_time, end_time, category, created_by,
                ticket_price, status
            )
            VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8, $9, $10, 'active')
            RETURNING 
                id, title, description, 
                ST_X(location::geometry) as longitude,
                ST_Y(location::geometry) as latitude,
                address, start_time, end_time, category, 
                created_by, ticket_price, status, created_at
        `;
        const values = [
            title, description, longitude, latitude, address,
            startTime, endTime, category, createdBy, ticketPrice
        ];
        
        const result = await pool.query(query, values);
        return result.rows[0];
    }
    static async findNearby(latitude, longitude, radiusKm, filters = {}) {
        let query = `
            SELECT 
                e.id, e.title, e.description, 
                ST_X(e.location::geometry) as longitude,
                ST_Y(e.location::geometry) as latitude,
                e.address,
                ST_DistanceSphere(
                    e.location, 
                    ST_MakePoint($1, $2)
                ) / 1000 as distance,
                e.start_time, e.end_time, e.category,
                e.ticket_price, e.status,
                u.username as creator_name
            FROM events e
            JOIN users u ON e.created_by = u.id
            WHERE ST_DWithin(
                e.location::geography, 
                ST_MakePoint($1, $2)::geography, 
                $3 * 1000
            )
        `;
        
        const values = [longitude, latitude, radiusKm];
        let paramIndex = 4;
        
        // Apply filters
        if (filters.category) {
            query += ` AND e.category = $${paramIndex}`;
            values.push(filters.category);
            paramIndex++;
        }
        
        if (filters.maxPrice !== undefined) {
            query += ` AND e.ticket_price <= $${paramIndex}`;
            values.push(filters.maxPrice);
            paramIndex++;
        }
        
        if (filters.startDate) {
            query += ` AND e.start_time >= $${paramIndex}`;
            values.push(filters.startDate);
            paramIndex++;
        }
        
        if (filters.endDate) {
            query += ` AND e.end_time <= $${paramIndex}`;
            values.push(filters.endDate);
            paramIndex++;
        }
        
        // Default to active events if no status specified
        query += ` AND e.status = $${paramIndex}`;
        values.push(filters.status || 'active');
        paramIndex++;
        
        query += ' ORDER BY distance';
        
        const result = await pool.query(query, values);
        return result.rows;
    }

    /**
     * Update an event
     * @param {number} eventId 
     * @param {object} updates 
     * @returns {Promise<object>} Updated event
     */
    static async update(eventId, updates) {
        const { 
            title, description, latitude, longitude, address,
            startTime, endTime, category, ticketPrice, status
        } = updates;
        
        const setClauses = [];
        const values = [eventId];
        let paramIndex = 2;
        
        if (title !== undefined) {
            setClauses.push(`title = $${paramIndex}`);
            values.push(title);
            paramIndex++;
        }
        
        if (description !== undefined) {
            setClauses.push(`description = $${paramIndex}`);
            values.push(description);
            paramIndex++;
        }
        
        if (latitude !== undefined && longitude !== undefined) {
            setClauses.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)`);
            values.push(longitude, latitude);
            paramIndex += 2;
        }
        
        if (address !== undefined) {
            setClauses.push(`address = $${paramIndex}`);
            values.push(address);
            paramIndex++;
        }
        
        if (startTime !== undefined) {
            setClauses.push(`start_time = $${paramIndex}`);
            values.push(startTime);
            paramIndex++;
        }
        
        if (endTime !== undefined) {
            setClauses.push(`end_time = $${paramIndex}`);
            values.push(endTime);
            paramIndex++;
        }
        
        if (category !== undefined) {
            setClauses.push(`category = $${paramIndex}`);
            values.push(category);
            paramIndex++;
        }
        
        if (ticketPrice !== undefined) {
            setClauses.push(`ticket_price = $${paramIndex}`);
            values.push(ticketPrice);
            paramIndex++;
        }
        
        if (status !== undefined) {
            setClauses.push(`status = $${paramIndex}`);
            values.push(status);
        }
        
        if (setClauses.length === 0) {
            throw new Error('No updates provided');
        }
        
        // Add updated_at timestamp
        setClauses.push('updated_at = NOW()');
        
        const query = `
            UPDATE events
            SET ${setClauses.join(', ')}
            WHERE id = $1
            RETURNING 
                id, title, description, 
                ST_X(location::geometry) as longitude,
                ST_Y(location::geometry) as latitude,
                address, start_time, end_time, category, 
                created_by, ticket_price, status, updated_at
        `;
        
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Cancel an event (set status to 'cancelled')
     * @param {number} eventId 
     * @returns {Promise<boolean>} Success status
     */
    static async cancel(eventId) {
        const query = `
            UPDATE events
            SET status = 'cancelled', updated_at = NOW()
            WHERE id = $1
        `;
        const result = await pool.query(query, [eventId]);
        return result.rowCount > 0;
    }

    /**
     * Get event by ID
     * @param {number} id 
     * @returns {Promise<object>} Event details
     */
    static async findById(id) {
        const query = `
            SELECT 
                e.id, e.title, e.description, 
                ST_X(e.location::geometry) as longitude,
                ST_Y(e.location::geometry) as latitude,
                e.address, e.start_time, e.end_time, 
                e.category, e.created_by, e.ticket_price, e.status,
                u.username as creator_name
            FROM events e
            JOIN users u ON e.created_by = u.id
            WHERE e.id = $1
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    /**
     * Get events by creator
     * @param {number} userId 
     * @param {string} [status] - Filter by status
     * @returns {Promise<array>} Array of events
     */
    static async findByCreator(userId, status) {
        let query = `
            SELECT 
                id, title, description, 
                ST_X(location::geometry) as longitude,
                ST_Y(location::geometry) as latitude,
                address, start_time, end_time, 
                category, ticket_price, status, created_at
            FROM events
            WHERE created_by = $1
        `;
        
        const values = [userId];
        
        if (status) {
            query += ' AND status = $2';
            values.push(status);
        }
        
        query += ' ORDER BY start_time';
        
        const result = await pool.query(query, values);
        return result.rows;
    }
}

module.exports = Event;