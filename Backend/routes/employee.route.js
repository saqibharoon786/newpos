const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const { uploadEmployeeAvatar } = require('../utils/upload');

// @route   GET /api/employees
// @desc    Get all employees
// @access  Private
router.get('/get-all', employeeController.getEmployees);

// @route   GET /api/employees/stats
// @desc    Get employee statistics
// @access  Private
router.get('/stats', employeeController.getEmployeeStats);

// @route   GET /api/employees/:id
// @desc    Get single employee
// @access  Private
router.get('/:id', employeeController.getEmployeeById);

// @route   POST /api/employees
// @desc    Create new employee
// @access  Private
router.post('/create-employee', uploadEmployeeAvatar, employeeController.createEmployee);

// @route   PUT /api/employees/:id
// @desc    Update employee
// @access  Private
router.put('/:id', uploadEmployeeAvatar, employeeController.updateEmployee);

// @route   DELETE /api/employees/:id
// @desc    Delete employee
// @access  Private
router.delete('/:id', employeeController.deleteEmployee);

// @route   PATCH /api/employees/bulk-status
// @desc    Bulk update employee status
// @access  Private
router.patch('/bulk-status', employeeController.bulkUpdateStatus);

module.exports = router;