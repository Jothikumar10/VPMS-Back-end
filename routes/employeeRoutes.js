const express = require('express');
const router = express.Router();
const {
  getEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee,
} = require('../controllers/employeeController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

router.use(protect);

// Admin, receptionist, employees, and visitors can view the directory (needed for dropdowns)
router.get('/', authorize('admin', 'receptionist', 'employee', 'visitor'), getEmployees);
router.get('/:id', authorize('admin', 'receptionist', 'employee'), getEmployeeById);

// Only admin can manage employee records
router.post('/', authorize('admin'), createEmployee);
router.put('/:id', authorize('admin'), updateEmployee);
router.delete('/:id', authorize('admin'), deleteEmployee);

module.exports = router;