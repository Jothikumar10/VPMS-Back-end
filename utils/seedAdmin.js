require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const email = (process.env.SEED_ADMIN_EMAIL || 'admin@vpms.com').toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`Admin account already exists: ${email}`);
      process.exit(0);
    }

    await User.create({
      name: process.env.SEED_ADMIN_NAME || 'System Administrator',
      email,
      password: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
      role: 'admin',
    });

    console.log('Admin account created successfully:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${process.env.SEED_ADMIN_PASSWORD || 'Admin@12345'}`);
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
})();
