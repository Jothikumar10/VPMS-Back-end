const User = require('../models/User');
const Employee = require('../models/Employee');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @route GET /api/users (admin only)
const getUsers = asyncHandler(async (req, res) => {
  const { search, role } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  const users = await User.find(filter).populate('employee', 'name department').sort({ createdAt: -1 });
  res.json({ users: users.map((u) => u.toSafeObject()) });
});

// @route POST /api/users (admin only)
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, employeeId } = req.body;
  if (!name || !email || !password || !role) {
    throw new AppError('Name, email, password and role are required.', 400);
  }
  if (!['admin', 'receptionist', 'employee'].includes(role)) {
    throw new AppError('Invalid role.', 400);
  }
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new AppError('A user with this email already exists.', 409);

  let employeeRef = undefined;
  if (role === 'employee') {
    if (!employeeId) throw new AppError('employeeId is required for employee role accounts.', 400);
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new AppError('Linked employee not found.', 404);
    const alreadyLinked = await User.findOne({ employee: employeeId });
    if (alreadyLinked) throw new AppError('This employee already has a user account.', 409);
    employeeRef = employeeId;
  }

  const user = await User.create({ name, email, password, role, employee: employeeRef });
  res.status(201).json({ user: user.toSafeObject() });
});

// @route PUT /api/users/:id (admin only)
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found.', 404);

  const { name, email, role, isActive, password, employeeId } = req.body;

  if (email && email.toLowerCase() !== user.email) {
    const dup = await User.findOne({ email: email.toLowerCase() });
    if (dup) throw new AppError('A user with this email already exists.', 409);
    user.email = email;
  }
  if (name !== undefined) user.name = name;
  if (isActive !== undefined) user.isActive = isActive;
  if (role !== undefined) user.role = role;
  if (password) user.password = password;
  if (role === 'employee' && employeeId) user.employee = employeeId;

  await user.save();
  res.json({ user: user.toSafeObject() });
});

// @route DELETE /api/users/:id (admin only)
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found.', 404);
  if (String(user._id) === String(req.user._id)) {
    throw new AppError('You cannot delete your own account.', 400);
  }
  await user.deleteOne();
  res.json({ message: 'User deleted successfully.' });
});

module.exports = { getUsers, createUser, updateUser, deleteUser };
