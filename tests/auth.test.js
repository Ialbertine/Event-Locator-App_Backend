const request = require('supertest');
const app = require('../src/server');
const User = require('../src/models/user');
const { pool } = require('../src/config/db');
const jwt = require('jsonwebtoken');
const { redisCacheInstance } = require('../src/config/redis');

describe('Authentication API Tests', () => {
  let testUser;
  let authToken;
  let server;

  beforeAll(async () => {
    server = app.listen(0); // Use random available port
    await pool.query("DELETE FROM users WHERE email LIKE 'testauth%'");

    testUser = await User.create({
      username: 'testauthuser',
      email: 'testauth@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'Auth',
      phoneNumber: '1234567890',
      location: {
        type: "Point",
        coordinates: [-73.935242, 40.730610]
      }
    });
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email LIKE 'testauth%'");
    await redisCacheInstance.disconnect();
    await pool.end();
    await server.close();
  });

  describe('POST /api/users/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'testauth@example.com',
          password: 'TestPassword123!'
        });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('token');
      authToken = response.body.token;
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'testauth@example.com',
          password: 'wrongpassword'
        });

      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'testauth@example.com'
          // Missing password
        });

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('Authentication Middleware', () => {
    it('should allow access with valid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.email).toBe('testauth@example.com');
    });

    it('should reject access with malformed token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer malformed.token.here');

      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject access without token', async () => {
      const response = await request(app)
        .get('/api/users/profile');

      expect(response.statusCode).toBe(401);
    });
  });
});