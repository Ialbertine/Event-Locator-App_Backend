const request = require('supertest');
const app = require('../src/server');
const User = require('../src/models/user');
const { pool } = require('../src/config/db');
const argon2 = require('argon2');

describe('User API Tests', () => {
  let testUser;
  let authToken;
  let server;

  beforeAll(async () => {
    server = app.listen(0); // Use random available port
    await pool.query("DELETE FROM users WHERE email LIKE 'testuser%'");

    testUser = await User.create({
      username: 'testuser',
      email: 'testuser@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: '1234567890',
      location: {
        type: "Point",
        coordinates: [-73.935242, 40.730610]
      }
    });

    const loginRes = await request(app)
      .post('/api/users/login')
      .send({
        email: 'testuser@example.com',
        password: 'TestPassword123!'
      });
    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email LIKE 'testuser%'");
    await pool.end();
    await server.close();
  });

  describe('POST /api/users/register', () => {
    it('should register a new user with valid data', async () => {
      const newUser = {
        username: 'newtestuser',
        email: 'newtestuser@example.com',
        password: 'ValidPass123!',
        firstName: 'New',
        lastName: 'User',
        phoneNumber: '1234567890',
        longitude: -74.0060,
        latitude: 40.7128
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(newUser);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('message');
      expect(response.body.user.email).toBe(newUser.email);
    });

    it('should reject registration with invalid data', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          username: 'a', // Too short
          email: 'invalid-email', // Invalid format
          password: 'short', // Too short
          firstName: '1', // Invalid characters
          lastName: '2', // Invalid characters
          phoneNumber: 'not-a-phone'
        });

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/users/profile', () => {
    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.email).toBe('testuser@example.com');
    });
  });

  describe('PUT /api/users/update-profile', () => {
    it('should update user profile', async () => {
      const updates = {
        firstName: 'Updated',
        lastName: 'Name',
        phoneNumber: '9876543210',
        longitude: -74.0060,
        latitude: 40.7128
      };

      const response = await request(app)
        .put('/api/users/update-profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates);

      expect(response.statusCode).toBe(200);
      expect(response.body.user.firstName).toBe(updates.firstName);
      expect(response.body.user.lastName).toBe(updates.lastName);
    });

    it('should reject invalid profile updates', async () => {
      const response = await request(app)
        .put('/api/users/update-profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          phoneNumber: 'invalid'
        });

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('DELETE /api/users/delete-profile', () => {
    it('should delete user profile', async () => {
      // Create temporary user to delete
      const tempUser = await User.create({
        username: 'tempuser',
        email: 'tempuser@example.com',
        password: 'TempPass123!',
        firstName: 'Temp',
        lastName: 'User',
        phoneNumber: '1111111111'
      });

      const loginRes = await request(app)
        .post('/api/users/login')
        .send({
          email: 'tempuser@example.com',
          password: 'TempPass123!'
        });
      const tempToken = loginRes.body.token;

      const response = await request(app)
        .delete('/api/users/delete-profile')
        .set('Authorization', `Bearer ${tempToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('message');

      // Verify user is marked as deleted
      const dbUser = await pool.query(
        "SELECT status FROM users WHERE email = 'tempuser@example.com'"
      );
      expect(dbUser.rows[0].status).toBe('deleted');
    });
  });
});