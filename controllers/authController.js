const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

// Generate JWT
const signToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    }
  );
};

// =======================
// Register
// =======================
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    throw new AppError(
      "Name, email, password and role are required.",
      400
    );
  }

  const allowedRoles = [
    "admin",
    "receptionist",
    "employee",
    "visitor",
  ];

  if (!allowedRoles.includes(role)) {
    throw new AppError("Invalid user role.", 400);
  }

  const existingUser = await User.findOne({
    email: email.toLowerCase(),
  });

  if (existingUser) {
    throw new AppError("Email already exists.", 400);
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role,
    isActive: true,
  });

  const token = signToken(user);

  res.status(201).json({
    success: true,
    message: "Registration successful.",
    token,
    user: user.toSafeObject(),
  });
});

// =======================
// Login
// =======================
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError(
      "Email and password are required.",
      400
    );
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
  }).select("+password");

  if (!user) {
    throw new AppError("Invalid email or password.", 401);
  }

  if (!user.isActive) {
    throw new AppError(
      "Your account has been deactivated.",
      403
    );
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw new AppError("Invalid email or password.", 401);
  }

  const token = signToken(user);

  res.status(200).json({
    success: true,
    message: "Login successful.",
    token,
    user: user.toSafeObject(),
  });
});

// =======================
// Logged In User
// =======================
const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user.toSafeObject(),
  });
});

// =======================
// Change Password
// =======================
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError(
      "Current password and new password are required.",
      400
    );
  }

  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    throw new AppError(
      "Current password is incorrect.",
      401
    );
  }

  user.password = newPassword;

  await user.save();

  res.status(200).json({
    success: true,
    message: "Password updated successfully.",
  });
});

module.exports = {
  register,
  login,
  getMe,
  changePassword,
};