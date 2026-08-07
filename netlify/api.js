const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const mongoose = require('mongoose');

// Import your existing database connection and routes
const connectDB = require('../../config/db'); // Path to your DB connection file
const employeeRoutes = require('../../routes/employeeRoutes');
const visitRequestRoutes = require('../../routes/visitRequestRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Ensure MongoDB connects during serverless invocation
connectDB();

// Mount API routes
app.use('/.netlify/functions/api/employees', employeeRoutes);
app.use('/.netlify/functions/api/visit-requests', visitRequestRoutes);

// Export serverless wrapper
module.exports.handler = serverless(app);