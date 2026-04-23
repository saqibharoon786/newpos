// routes/employee.routes.js
const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const { uploadEmployeeFiles } = require('../utils/upload'); // Make sure this is the correct import

// Debug middleware to log requests
const debugMiddleware = (req, res, next) => {
    console.log('Request received:', {
        method: req.method,
        url: req.url,
        body: req.body,
        files: req.files,
        headers: req.headers
    });
    next();
};

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

// @route   POST /api/employees/create-employee
// @desc    Create new employee with multiple file uploads
// @access  Private
router.post('/create-employee', debugMiddleware, uploadEmployeeFiles, employeeController.createEmployee);

// @route   PUT /api/employees/:id
// @desc    Update employee with multiple file uploads
// @access  Private
router.put('/:id', uploadEmployeeFiles, employeeController.updateEmployee);

// @route   DELETE /api/employees/:id
// @desc    Delete employee
// @access  Private
router.delete('/:id', employeeController.deleteEmployee);

// @route   PATCH /api/employees/bulk-status
// @desc    Bulk update employee status
// @access  Private
router.patch('/bulk-status', employeeController.bulkUpdateStatus);

module.exports = router;