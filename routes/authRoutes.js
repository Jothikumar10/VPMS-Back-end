const express = require("express");
const router = express.Router();

const {
  register,
  login,
  getMe,
  changePassword,
} = require("../controllers/authController");

const { protect } = require("../middleware/auth");

// Register
router.post("/register", register);

// Login
router.post("/login", login);

// Get logged-in user
router.get("/me", protect, getMe);

// Change password
router.put("/change-password", protect, changePassword);

module.exports = router;