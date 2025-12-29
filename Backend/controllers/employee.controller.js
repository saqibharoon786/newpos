const Employee = require('../models/employee.model');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Helper function to delete file
const deleteFile = (filePath) => {
    if (!filePath) return false;
    
    try {
        // Check if file exists
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting file:', error);
        return false;
    }
};

// Helper function to get file URL
const getFileUrl = (req, filePath) => {
    if (!filePath) return null;
    
    // If it's already a URL, return as is
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return filePath;
    }
    
    // Check if it's a default avatar
    if (filePath.includes('images.unsplash.com')) {
        return filePath;
    }
    
    try {
        // Check if file exists locally
        if (fs.existsSync(filePath)) {
            // Convert local path to URL
            const relativePath = filePath.replace(/^\.\//, '').replace(/\\/g, '/');
            return `${req.protocol}://${req.get('host')}/${relativePath}`;
        }
    } catch (error) {
        console.error('Error getting file URL:', error);
    }
    
    return null;
};

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private
const getEmployees = async (req, res) => {
    try {
        const { search, department, title } = req.query;
        
        let query = {};
        
        // Search functionality
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { employeeId: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Filter by department
        if (department) {
            query.department = department;
        }
        
        // Filter by title
        if (title) {
            query.title = title;
        }
        
        const employees = await Employee.find(query).sort({ createdAt: -1 });
        
        // Default avatar URL
        const defaultAvatar = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
        
        // Map to match frontend structure
        const formattedEmployees = employees.map(emp => {
            const avatarUrl = getFileUrl(req, emp.avatar) || defaultAvatar; 
            
            return {
                _id: emp._id,
                id: emp.employeeId,
                name: emp.name,
                title: emp.title,
                department: emp.department,
                email: emp.email,
                phone: emp.phone,
                schedule: emp.schedule, // Virtual property
                salary: `Rs. ${emp.salary?.toLocaleString() || '0'}`,
                avatar: avatarUrl,
                address: emp.address || '',
                cnic: emp.cnic || '',
                dob: emp.dob ? emp.dob.toISOString().split('T')[0] : '',
                emergencyContact: emp.emergencyContact || '',
                reportingManager: emp.reportingManager || '',
                hireDate: emp.hireDate ? emp.hireDate.toISOString().split('T')[0] : '',
                responsibilities: emp.responsibilities || '',
                isActive: emp.isActive !== undefined ? emp.isActive : true
            };
        });
        
        res.json({
            success: true,
            count: formattedEmployees.length,
            data: formattedEmployees
        });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get single employee
// @route   GET /api/employees/:id
// @access  Private
const getEmployeeById = async (req, res) => {
    try {
        const employee = await Employee.findOne({ employeeId: req.params.id });
        
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }
        
        // Default avatar URL
        const defaultAvatar = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
        const avatarUrl = getFileUrl(req, employee.avatar) || defaultAvatar;
        
        // Format employee data
        const formattedEmployee = {
            id: employee.employeeId,
            name: employee.name,
            title: employee.title,
            department: employee.department,
            email: employee.email,
            phone: employee.phone,
            schedule: employee.schedule,
            salary: `Rs. ${employee.salary?.toLocaleString() || '0'}`,
            avatar: avatarUrl,
            address: employee.address || '',
            cnic: employee.cnic || '',
            dob: employee.dob ? employee.dob.toISOString().split('T')[0] : '',
            emergencyContact: employee.emergencyContact || '',
            reportingManager: employee.reportingManager || '',
            hireDate: employee.hireDate ? employee.hireDate.toISOString().split('T')[0] : '',
            responsibilities: employee.responsibilities || '',
            startTime: employee.startTime || '',
            endTime: employee.endTime || '',
            isActive: employee.isActive !== undefined ? employee.isActive : true,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt
        };
        
        res.json({
            success: true,
            data: formattedEmployee
        });
    } catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Create new employee
// @route   POST /api/employees
// @access  Private
const createEmployee = async (req, res) => {
    try {
        // Validate required fields
        const requiredFields = ['employeeId', 'name', 'email', 'phone', 'salary'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            // Delete uploaded file if exists
            if (req.file) {
                deleteFile(req.file.path);
            }
            
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }
        
        // Check if employee ID, email or CNIC already exists
        const existingEmployee = await Employee.findOne({ 
            $or: [
                { employeeId: req.body.employeeId },
                { email: req.body.email }
            ]
        });
        
        if (existingEmployee) {
            // Delete uploaded file if exists
            if (req.file) {
                deleteFile(req.file.path);
            }
            
            let field = '';
            if (existingEmployee.employeeId === req.body.employeeId) field = 'Employee ID';
            else field = 'Email';
            
            return res.status(400).json({
                success: false,
                message: `${field} already exists`
            });
        }
        
        // Check CNIC if provided
        if (req.body.cnic) {
            const existingCNIC = await Employee.findOne({ cnic: req.body.cnic });
            if (existingCNIC) {
                if (req.file) {
                    deleteFile(req.file.path);
                }
                return res.status(400).json({
                    success: false,
                    message: 'CNIC already exists'
                });
            }
        }
        
        // Prepare employee data
        const employeeData = {
            employeeId: req.body.employeeId.trim(),
            name: req.body.name.trim(),
            title: req.body.title || '',
            department: req.body.department || '',
            email: req.body.email.trim(),
            phone: req.body.phone.trim(),
            startTime: req.body.startTime || '09:00',
            endTime: req.body.endTime || '17:00',
            salary: parseFloat(req.body.salary.replace(/[^0-9.-]+/g, "")) || 0,
            address: req.body.address || '',
            cnic: req.body.cnic || '',
            dob: req.body.dob ? new Date(req.body.dob) : null,
            emergencyContact: req.body.emergencyContact || '',
            reportingManager: req.body.reportingManager || '',
            hireDate: req.body.hireDate ? new Date(req.body.hireDate) : new Date(),
            responsibilities: req.body.responsibilities || '',
            isActive: req.body.isActive !== undefined ? req.body.isActive : true
        };
        
        // Add avatar path if file was uploaded
        if (req.file) {
            employeeData.avatar = req.file.path;
        }
        
        // Create employee
        const employee = await Employee.create(employeeData);
        
        // Default avatar URL
        const defaultAvatar = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
        const avatarUrl = getFileUrl(req, employee.avatar) || defaultAvatar;
        
        // Format response
        const formattedEmployee = {
            id: employee.employeeId,
            name: employee.name,
            title: employee.title,
            department: employee.department,
            email: employee.email,
            phone: employee.phone,
            schedule: employee.schedule,
            salary: `Rs. ${employee.salary?.toLocaleString() || '0'}`,
            avatar: avatarUrl,
            address: employee.address || '',
            cnic: employee.cnic || '',
            dob: employee.dob ? employee.dob.toISOString().split('T')[0] : '',
            emergencyContact: employee.emergencyContact || '',
            reportingManager: employee.reportingManager || '',
            hireDate: employee.hireDate ? employee.hireDate.toISOString().split('T')[0] : '',
            responsibilities: employee.responsibilities || '',
            isActive: employee.isActive
        };
        
        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            data: formattedEmployee
        });
    } catch (error) {
        // Delete uploaded file if error occurs
        if (req.file) {
            deleteFile(req.file.path);
        }
        
        console.error('Error creating employee:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating employee',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private
const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }
    // Handle file upload if exists
    if (req.file) {
      updateData.avatar = req.file.path;
    }

    // Update employee by MongoDB _id
    const employee = await Employee.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!employee) {
      // Delete uploaded file if employee not found
      if (req.file) {
        deleteFile(req.file.path);
      }
      
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Format the response
    const formattedEmployee = {
      _id: employee._id,
      employeeId: employee.employeeId,
      name: employee.name,
      title: employee.title || "",
      department: employee.department || "",
      email: employee.email,
      phone: employee.phone,
      schedule: employee.schedule || "",
      salary: employee.salary ? `Rs. ${employee.salary.toLocaleString()}` : "Rs. 0",
      avatar: employee.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
      address: employee.address || "",
      cnic: employee.cnic || "",
      dob: employee.dob ? employee.dob.toISOString().split('T')[0] : "",
      emergencyContact: employee.emergencyContact || "",
      reportingManager: employee.reportingManager || "",
      hireDate: employee.hireDate ? employee.hireDate.toISOString().split('T')[0] : "",
      responsibilities: employee.responsibilities || "",
      isActive: employee.isActive || true,
      startTime: employee.startTime || "09:00",
      endTime: employee.endTime || "17:00",
    };

    res.json({
      success: true,
      message: "Employee updated successfully",
      data: formattedEmployee,
    });
  } catch (error) {
    console.error("Error updating employee:", error);

    // Delete uploaded file if error occurs
    if (req.file) {
      deleteFile(req.file.path);
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while updating employee",
      error: error.message,
    });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    const employee = await Employee.findByIdAndDelete(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Delete avatar file if exists and is not a default URL
    if (employee.avatar && !employee.avatar.includes('images.unsplash.com')) {
      deleteFile(employee.avatar);
    }

    res.json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting employee:", error);

    res.status(500).json({
      success: false,
      message: "Server error while deleting employee",
      error: error.message,
    });
  }
};

// @desc    Get employee stats
// @route   GET /api/employees/stats
// @access  Private
const getEmployeeStats = async (req, res) => {
    try {
        const totalEmployees = await Employee.countDocuments();
        const activeEmployees = await Employee.countDocuments({ isActive: true });
        const departments = await Employee.distinct('department');
        
        // Get department-wise count
        const departmentStats = await Employee.aggregate([
            { $group: { _id: '$department', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        // Get recent hires (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentHires = await Employee.countDocuments({
            hireDate: { $gte: thirtyDaysAgo }
        });
        
        res.json({
            success: true,
            data: {
                totalEmployees,
                activeEmployees,
                inactiveEmployees: totalEmployees - activeEmployees,
                activeDepartments: departments.length,
                recentHires,
                departmentStats,
                pendingInterviews: 2 // This can be dynamic based on your interview model
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Bulk update employees status
// @route   PATCH /api/employees/bulk-status
// @access  Private
const bulkUpdateStatus = async (req, res) => {
    try {
        const { employeeIds, isActive } = req.body;
        
        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Employee IDs are required'
            });
        }
        
        if (isActive === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }
        
        const result = await Employee.updateMany(
            { employeeId: { $in: employeeIds } },
            { isActive: isActive === 'true' || isActive === true }
        );
        
        res.json({
            success: true,
            message: `Successfully updated ${result.modifiedCount} employees`,
            data: result
        });
    } catch (error) {
        console.error('Error in bulk update:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating employees',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    getEmployeeStats,
    bulkUpdateStatus,
    deleteFile,
    getFileUrl
};