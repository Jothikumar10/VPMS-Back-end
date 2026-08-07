# Visitor Pass Management System - Backend

## Overview

The Visitor Pass Management System (VPMS) backend is built using the MERN stack. It provides REST APIs for user authentication, employee management, visitor registration, visit request processing, complaint management, and dashboard analytics.

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- bcrypt
- dotenv
- CORS
- Multer (if using file uploads)

## Features

- JWT Authentication
- Role-Based Access Control
- Employee Management
- Visitor Registration
- Visit Request Approval Workflow
- Check-In / Check-Out
- Visitor Pass Generation
- Complaint Management
- Dashboard Statistics
- Reports API

## Project Structure

```
backend/
│
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── utils/
├── uploads/
├── app.js
├── server.js
├── package.json
└── .env
```

## Installation

```bash
git clone <repository-url>
cd backend
npm install
```

## Environment Variables

Create a `.env` file.

```
PORT=5000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
```

## Run the Server

Development

```bash
npm run dev
```

Production

```bash
npm start
```

## API Endpoints

### Authentication

- POST /api/auth/login
- GET /api/auth/me
- PUT /api/auth/change-password

### Employees

- GET /api/employees
- POST /api/employees
- PUT /api/employees/:id
- DELETE /api/employees/:id

### Visitors

- POST /api/visitors
- GET /api/visitors
- GET /api/visitors/:id

### Visit Requests

- POST /api/visit-requests
- GET /api/visit-requests
- PUT /api/visit-requests/:id/approve
- PUT /api/visit-requests/:id/reject

### Check-In / Check-Out

- PUT /api/visit-requests/:id/checkin
- PUT /api/visit-requests/:id/checkout

### Complaints

- POST /api/complaints
- GET /api/complaints
- PUT /api/complaints/:id/status

## Roles

- Admin
- Receptionist
- Employee
- Visitor

## License

MIT
