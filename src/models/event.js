const { pool } = require('../config/db');

class Event {
    constructor(data = {}) {
        this.id = data.id || null;
        this.title = data.title || '';
        this.description = data.description || '';
        this.location = data.location || null;
        this.address = data.address || '';
        this.start_time = data.start_time || null;
        this.end_time = data.end_time || null;
        this.category = data.category || '';
        this.ticket_price = data.ticket_price || 0.00;
        this.status = data.status || 'active';
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    // Create a new event
    static async create(eventData) {
        try {
            const {
                title, description, longitude, latitude, address,
                start_time, end_time, category, ticket_price, status = 'active'
            } = eventData;

            const query = `
                INSERT INTO events(
                    title, description, location, address, 
                    start_time, end_time, category, 
                    ticket_price, status, created_at, updated_at
                ) VALUES(
                    $1, $2, ST_MakePoint($3, $4)::geography, $5, 
                    $6, $7, $8, $9, $10, NOW(), NOW()
                ) RETURNING *;
            `;

            const values = [
                title, description, longitude, latitude, address,
                start_time, end_time, category, ticket_price, status
            ];

            const { rows } = await pool.query(query, values);
            return new Event(rows[0]);
        } catch (error) {
            console.error('Error creating event:', error);
            throw error;
        }
    }

    // Get event by ID
    static async getById(id) {
        try {
            const query = `
                SELECT 
                    id, title, description, 
                    ST_X(location::geometry) as longitude,
                    ST_Y(location::geometry) as latitude,
                    address, start_time, end_time, category, 
                     ticket_price, status, created_at, updated_at
                FROM events
                WHERE id = $1 AND status != 'cancelled';
            `;

            const { rows } = await pool.query(query, [id]);
            
            if (rows.length === 0) {
                return null;
            }
            
            return new Event(rows[0]);
        } catch (error) {
            console.error('Error getting event by ID:', error);
            throw error;
        }
    }

    // Get all events with filters
    static async getAll(filters = {}) {
      try {
          let query = `
              SELECT 
                  id, title, description, 
                  ST_X(location::geometry) as longitude,
                  ST_Y(location::geometry) as latitude,
                  address, start_time, end_time, category, 
                   ticket_price, status, created_at, updated_at
              FROM events
              WHERE status != 'cancelled'
          `;
  
          const values = [];
          let paramPosition = 1;
  
          // Filter by name (new)
          if (filters.name) {
              query += ` AND LOWER(title) LIKE LOWER($${paramPosition})`;
              values.push(`%${filters.name}%`);
              paramPosition++;
          }
  
          // Filter by category
          if (filters.category) {
              query += ` AND category = $${paramPosition}`;
              values.push(filters.category);
              paramPosition++;
          }
  
          // Filter by date range
          if (filters.startDate) {
              query += ` AND start_time >= $${paramPosition}`;
              values.push(filters.startDate);
              paramPosition++;
          }
  
          if (filters.endDate) {
              query += ` AND end_time <= $${paramPosition}`;
              values.push(filters.endDate);
              paramPosition++;
          }
  
          // Filter by address (new)
          if (filters.address) {
              query += ` AND LOWER(address) LIKE LOWER($${paramPosition})`;
              values.push(`%${filters.address}%`);
              paramPosition++;
          }

  
          // Add order by clause
          query += ' ORDER BY start_time ASC';
  
          // Add pagination
          if (filters.limit) {
              query += ` LIMIT $${paramPosition}`;
              values.push(filters.limit);
              paramPosition++;
  
              if (filters.offset) {
                  query += ` OFFSET $${paramPosition}`;
                  values.push(filters.offset);
                  paramPosition++;
              }
          }
  
          const { rows } = await pool.query(query, values);
          return rows.map(row => new Event(row));
      } catch (error) {
          console.error('Error getting all events:', error);
          throw error;
      }
  }

    // Find events nearby a location within a radius
    static async findNearby(latitude, longitude, radiusKm, filters = {}) {
      try {
        let query = `
            SELECT 
                id, title, description, 
                ST_X(location::geometry) as longitude,
                ST_Y(location::geometry) as latitude,
                address, start_time, end_time, category, 
                ticket_price, status, created_at, updated_at,
                ST_Distance(
                    location::geography, 
                    ST_MakePoint($1, $2)::geography
                ) / 1000 as distance_km
            FROM events
            WHERE ST_DWithin(
                location::geography, 
                ST_MakePoint($1, $2)::geography, 
                $3 * 1000
            )
            AND status != 'cancelled'
        `;

        const values = [longitude, latitude, radiusKm];
        let paramPosition = 4;
  
          // Filter by name
          if (filters.name) {
              query += ` AND LOWER(title) LIKE LOWER($${paramPosition})`;
              values.push(`%${filters.name}%`);
              paramPosition++;
          }
  
          // Filter by category
          if (filters.category && filters.category.trim() !== '') {
            query += ` AND category = $${paramPosition}`;
            values.push(filters.category.trim()); 
            paramPosition++;
          }
  
          // Filter by date range
          if (filters.startDate) {
              query += ` AND start_time >= $${paramPosition}`;
              values.push(filters.startDate);
              paramPosition++;
          }

          // Filter by address
          if (filters.address) {
              query += ` AND LOWER(address) LIKE LOWER($${paramPosition})`;
              values.push(`%${filters.address}%`);
              paramPosition++;
          }
  
          // Add order by distance
          query += ' ORDER BY distance_km ASC';
  
  
          const { rows } = await pool.query(query, values);
          return rows.map(row => ({
              ...new Event(row),
              distance_km: row.distance_km
          }));
      } catch (error) {
          console.error('Error finding nearby events:', error);
          throw error;
      }
  }
    // Update an event
    static async update(id, eventData) {
        try {
            const updateFields = [];
            const values = [];
            let paramPosition = 1;

            // Build update fields
            for (const [key, value] of Object.entries(eventData)) {
                if (key === 'id') continue;
                if (key === 'longitude' || key === 'latitude') continue;

                updateFields.push(`${key} = $${paramPosition}`);
                values.push(value);
                paramPosition++;
            }

            // Handle location update
            if (eventData.longitude && eventData.latitude) {
                updateFields.push(`location = ST_MakePoint($${paramPosition}, $${paramPosition + 1})::geography`);
                values.push(eventData.longitude, eventData.latitude);
                paramPosition += 2;
            }

            // Add updated_at timestamp
            updateFields.push(`updated_at = NOW()`);
            values.push(id);

            const query = `
                UPDATE events
                SET ${updateFields.join(', ')}
                WHERE id = $${paramPosition}
                RETURNING *;
            `;

            const { rows } = await pool.query(query, values);
            
            if (rows.length === 0) {
                return null;
            }
            
            return new Event(rows[0]);
        } catch (error) {
            console.error('Error updating event:', error);
            throw error;
        }
    }

    // Delete an event by changing status)
    static async delete(id) {
        try {
            const query = `
                UPDATE events
                SET status = 'cancelled', updated_at = NOW()
                WHERE id = $1
                RETURNING *;
            `;

            const { rows } = await pool.query(query, [id]);
            
            if (rows.length === 0) {
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error deleting event:', error);
            throw error;
        }
    }

    // Get event categories
    static async getCategories() {
        try {
            const query = `
                SELECT DISTINCT category
                FROM events
                WHERE status != 'cancelled'
                ORDER BY category;
            `;

            const { rows } = await pool.query(query);
            return rows.map(row => row.category);
        } catch (error) {
            console.error('Error getting event categories:', error);
            throw error;
        }
    }

    // Count events with filters
    static async count(filters = {}) {
      try {
          let query = `
              SELECT COUNT(*) as total
              FROM events
              WHERE status != 'cancelled'
          `;
  
          const values = [];
          let paramPosition = 1;
  
          // Filter by name 
          if (filters.name) {
              query += ` AND LOWER(title) LIKE LOWER($${paramPosition})`;
              values.push(`%${filters.name}%`);
              paramPosition++;
          }
  
          // Filter by category
          if (filters.category && filters.category.trim() !== '') {
            query += ` AND category = $${paramPosition}`;
            values.push(filters.category.trim()); 
            paramPosition++;
          }
  
          // Filter by date range
          if (filters.startDate) {
              query += ` AND start_time >= $${paramPosition}`;
              values.push(filters.startDate);
              paramPosition++;
          }
  
          // Filter by address
          if (filters.address) {
              query += ` AND LOWER(address) LIKE LOWER($${paramPosition})`;
              values.push(`%${filters.address}%`);
              paramPosition++;
          }
  
          const { rows } = await pool.query(query, values);
          return parseInt(rows[0].total);
      } catch (error) {
          console.error('Error counting events:', error);
          throw error;
      }
  }
}

module.exports = Event;