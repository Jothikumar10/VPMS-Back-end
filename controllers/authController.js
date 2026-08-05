const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    }
  );

// Register
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    throw new AppError(
      "Name, email, password and role are required.",
      400
    );
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
    token,
    user: user.toSafeObject(),
  });
});

// Login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Email and password are required.", 400);
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
  }).select("+password");

  if (!user) {
    throw new AppError("Invalid email or password.", 401);
  }

  if (!user.isActive) {
    throw new AppError(
      "Your account has been deactivated. Contact the administrator.",
      403
    );
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw new AppError("Invalid email or password.", 401);
  }

  const token = signToken(user);

  res.json({
    token,
    user: user.toSafeObject(),
  });
});

// Get Logged-in User
const getMe = asyncHandler(async (req, res) => {
  res.json({
    user: req.user.toSafeObject(),
  });
});

// Change Password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError(
      "Current and new password are required.",
      400
    );
  }

  const user = await User.findById(req.user._id).select("+password");

  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    throw new AppError("Current password is incorrect.", 401);
  }

  user.password = newPassword;
  await user.save();

  res.json({
    message: "Password updated successfully.",
  });
});

module.exports = {
  register,
  login,
  getMe,
  changePassword,
};