# Event Locator App Backend

## Project Description

The Event Locator App is a multi-user backend system built with Node.js and Express.js, leveraging PostgreSQL with PostGIS for geospatial data handling. This project enables users to discover and manage events based on location and personal preferences. It incorporates authentication, location-based search, event categorization, multilingual support, and a notification system. The project also includes robust error handling, security best practices, and unit testing to ensure reliability and maintainability.

## Features

### User Management

- Secure user registration and authentication using password hashing (argon2) and JWT.
- User profile management with support for setting location and preferred event categories.

### Event Management

- Create, read, update, and delete (CRUD) operations for events.
- Store event details, including location (latitude/longitude), date/time, and category.
- Restrict deletion to event owners.

### Location-Based Search

- Find events within a specified radius of a user's location.
- Search by event category, name, or address.
- Retrieve nearby events dynamically.

### Multilingual Support (i18n)

- Users can select their preferred language.
- Implemented using `i18next` with `i18next-fs-backend` and `i18next-http-middleware`.

### Notification System

- Uses Redis Pub/Sub or RabbitMQ to manage event-related notifications asynchronously.
- Sends notifications to users about upcoming events matching their preferences.

### Security & Performance Enhancements

- Rate limiting with `express-rate-limit`.
- Helmet for securing HTTP headers.
- Input validation with `express-validator`.
- Logging with `winston` and request logging via `morgan`.

### Unit Testing

- Comprehensive test suite using Jest and Supertest.
- Test coverage for authentication, event management, search functionality, and notifications.

## Technology Stack

- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL with PostGIS for geospatial queries
- **Authentication:** JWT and Passport.js
- **Geolocation:** `node-geocoder`
- **Internationalization:** `i18next`
- **Asynchronous Processing:** Redis Pub/Sub or RabbitMQ
- **Testing:** Jest, Supertest
- **Security:** Helmet, Rate Limiting, Input Validation
- **Logging:** Winston, Morgan

## API Endpoints

### Authentication (`/auth`)

- `POST api/register` - Register a new user.
- `POST api/login` - Authenticate user and return JWT.
- `GET api/profile` - Retrieve user profile.
- `PUT api/update-profile` - Update user profile.
- `DELETE api/delete-profile` - Remove user account.

### Event Management (`/event`)

- `POST api/events` - Create a new event.
- `GET api/events` - Retrieve all events.
- `GET api/events/:id` - Fetch details of a specific event.
- `GET api/api/events/categories` - Fetch events categories
- `GET /api/events?category=name_category` - Search events by category.
- `GET /api/events?name=your_name` - Search events by name.
- `GET /api/events?address=your_address` - Find events by address.
- `GET /api/events/nearby` - Fetch nearby events.
- `GET /api/events/distance` - Calculate the distance to events.
- `PUT /api/events/:id` - Update event details.
- `DELETE /api/events/:id` - Remove an event (owner of the events).

### Notifications (`/notification`)

- Supports real-time event notifications via message queues.

## Installation & Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Ialbertine/Event-Locator-App_Backend.git
   cd Event-Locator-App_Backend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file and configure necessary credentials:

   ```env
   DB_USER=your user name
   DB_PASSWORD=your password
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=your database name
   JWT_SECRET=your secret
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

4. **For the database Postgresql I used cmd as an administrator:**

   ```bash
   psql -U albertine -d event_locator_db # this is used to connect to postgresql using command line
   CREATE EXTENSION postgis; #enable postGIS for postgresql

   \c event_locator_db # to access the event locator database
   SELECT * FROM users; # this will show table contains all field in users table and all users
   SELECT * FROM events; # this will show all from table events
   ```

5. **Start the server:**

   ```bash
   npm run dev
   ```

6. **Run tests:**
   ```bash
   npm test # for testing
   ```

**Author:** Albertine INGABIRE

## Here is LINK to the DEMO video:

