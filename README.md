# Maid Finder Platform - Backend API

Production-ready Node.js/Express backend for the Maid Finder platform.

## Features

- **Authentication**: JWT-based auth with register/login
- **User Roles**: Client, Maid, Admin
- **Maid Profiles**: Skills, rates, availability, location, reviews
- **Bookings**: Create, manage, and track bookings
- **Reviews & Ratings**: Client reviews for maids
- **Security**: Helmet, rate limiting, mongo-sanitize, CORS
- **Validation**: express-validator for request validation

## Tech Stack

- Node.js + Express 5
- MongoDB + Mongoose
- JWT (jsonwebtoken)
- bcryptjs
- express-validator, helmet, morgan

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   - Copy `.env.example` to `.env`
   - Set `MONGODB_URI` (MongoDB connection string)
   - Set `JWT_SECRET` (strong random string for production)

3. **Run MongoDB** (locally or use Atlas)

4. **Start server**
   ```bash
   npm run dev    # Development (nodemon)
   npm start     # Production
   ```

## API Endpoints

Base URL: `/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/auth/register` | Register (client/maid) |
| POST | `/auth/login` | Login |
| GET | `/auth/me` | Get current user (protected) |
| GET | `/maids` | List maids (filter: city, skills, minRate, maxRate, minRating) |
| GET | `/maids/:id` | Get maid by user ID |
| PUT | `/maids/profile` | Update maid profile (maid only) |
| POST | `/bookings` | Create booking (protected) |
| GET | `/bookings` | Get my bookings (protected) |
| PATCH | `/bookings/:id/status` | Update booking status (protected) |
| GET | `/reviews/maid/:maidId` | Get maid reviews |
| POST | `/reviews` | Create review (protected) |

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET` (32+ chars)
- [ ] Use MongoDB Atlas or managed DB
- [ ] Configure `CORS_ORIGIN` for your frontend domain(s)
- [ ] Add payment integration (Stripe/PayPal) if needed
- [ ] Set up file upload (e.g. Cloudinary) for photos
- [ ] Add logging (Winston/Pino) and monitoring
