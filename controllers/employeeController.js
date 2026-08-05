const Employee = require('../models/Employee');
const User = require('../models/User');
const VisitRequest = require('../models/VisitRequest');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @route GET /api/employees
// Accessible to admin (manage) and receptionist (dropdown to select employee to visit)
const getEmployees = asyncHandler(async (req, res) => {
  const { search, active } = req.query;
  const filter = {};
  if (active === 'true') filter.isActive = true;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { department: { $regex: search, $options: 'i' } },
    ];
  }
  const employees = await Employee.find(filter).sort({ name: 1 });
  res.json({ employees });
});

const getEmployeeById = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new AppError('Employee not found.', 404);
  res.json({ employee });
});

// @route POST /api/employees (admin only)
const createEmployee = asyncHandler(async (req, res) => {
  const { name, email, phone, department, designation } = req.body;
  if (!name || !email || !phone || !department || !designation) {
    throw new AppError('All employee fields are required.', 400);
  }
  const existing = await Employee.findOne({ email: email.toLowerCase() });
  if (existing) throw new AppError('An employee with this email already exists.', 409);

  const employee = await Employee.create({ name, email, phone, department, designation });
  res.status(201).json({ employee });
});

// @route PUT /api/employees/:id (admin only)
const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new AppError('Employee not found.', 404);

  const { name, email, phone, department, designation, isActive } = req.body;
  if (email && email.toLowerCase() !== employee.email) {
    const dup = await Employee.findOne({ email: email.toLowerCase() });
    if (dup) throw new AppError('An employee with this email already exists.', 409);
  }

  if (name !== undefined) employee.name = name;
  if (email !== undefined) employee.email = email;
  if (phone !== undefined) employee.phone = phone;
  if (department !== undefined) employee.department = department;
  if (designation !== undefined) employee.designation = designation;
  if (isActive !== undefined) employee.isActive = isActive;

  await employee.save();
  res.json({ employee });
});

// @route DELETE /api/employees/:id (admin only)
const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new AppError('Employee not found.', 404);

  const linkedUser = await User.findOne({ employee: employee._id });
  if (linkedUser) {
    throw new AppError('Cannot delete employee with a linked user account. Deactivate instead.', 400);
  }
  const hasVisits = await VisitRequest.exists({ employee: employee._id });
  if (hasVisits) {
    employee.isActive = false;
    await employee.save();
    return res.json({ message: 'Employee has visit history and was deactivated instead of deleted.', employee });
  }

  await employee.deleteOne();
  res.json({ message: 'Employee deleted successfully.' });
});

module.exports = { getEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee };
