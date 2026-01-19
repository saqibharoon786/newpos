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
                cnicFrontImage: emp.cnicFrontImage,
                cnicBackImage: emp.cnicBackImage,
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
                advancePayment: emp.advancePayment || 0, // ADDED THIS LINE
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
            advancePayment: employee.advancePayment || 0, // ADDED THIS LINE
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
            // Delete uploaded files if exist
            if (req.files) {
                Object.values(req.files).forEach(fileArray => {
                    if (Array.isArray(fileArray)) {
                        fileArray.forEach(file => deleteFile(file.path));
                    }
                });
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
            // Delete uploaded files if exist
            if (req.files) {
                Object.values(req.files).forEach(fileArray => {
                    if (Array.isArray(fileArray)) {
                        fileArray.forEach(file => deleteFile(file.path));
                    }
                });
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
                // Delete uploaded files if exist
                if (req.files) {
                    Object.values(req.files).forEach(fileArray => {
                        if (Array.isArray(fileArray)) {
                            fileArray.forEach(file => deleteFile(file.path));
                        }
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: 'CNIC already exists'
                });
            }
        }
        
        // ============= FIXED DATE PARSING FUNCTION =============
        const parseDateString = (dateString) => {
            if (!dateString || dateString.trim() === '') return null;
            
            dateString = dateString.trim();
            
            console.log('Parsing date string:', dateString);
            
            // Handle DD/MM/YYYY format
            if (dateString.includes('/')) {
                const parts = dateString.split('/');
                
                if (parts.length === 3) {
                    const day = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10);
                    const year = parseInt(parts[2], 10);
                    
                    console.log('DD/MM/YYYY parsed:', { day, month, year });
                    
                    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && 
                        day >= 1 && day <= 31 && 
                        month >= 1 && month <= 12 &&
                        year >= 1900 && year <= 2100) {
                        
                        // Create date in UTC to avoid timezone issues
                        const date = new Date(Date.UTC(year, month - 1, day));
                        
                        // Additional validation
                        if (date.getUTCFullYear() === year && 
                            date.getUTCMonth() === month - 1 && 
                            date.getUTCDate() === day) {
                            console.log('Valid date created:', date.toISOString());
                            return date;
                        }
                    }
                }
            }
            
            console.log('Could not parse date, returning null');
            return null;
        };

        console.log('Request body dates:', {
            dob: req.body.dob,
            hireDate: req.body.hireDate
        });
        
        // Parse dates
        const dobDate = parseDateString(req.body.dob);
        const hireDate = parseDateString(req.body.hireDate) || new Date();
        
        console.log('Parsed dates:', {
            dobDate: dobDate ? dobDate.toISOString() : null,
            hireDate: hireDate ? hireDate.toISOString() : null
        });
        
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
            dob: dobDate,
            emergencyContact: req.body.emergencyContact || '',
            reportingManager: req.body.reportingManager || '',
            hireDate: hireDate,
            responsibilities: req.body.responsibilities || '',
            advancePayment: parseFloat(req.body.advancePayment) || 0,
            isActive: req.body.isActive !== undefined ? req.body.isActive : true
        };
        
        console.log('Final employee data to save:', employeeData);
        
        // Add avatar path if file was uploaded
        if (req.files && req.files.avatar) {
            employeeData.avatar = req.files.avatar[0].path;
        }
        
        // Add CNIC front image path if file was uploaded
        if (req.files && req.files.cnicFrontImage) {
            employeeData.cnicFrontImage = req.files.cnicFrontImage[0].path;
        }
        
        // Add CNIC back image path if file was uploaded
        if (req.files && req.files.cnicBackImage) {
            employeeData.cnicBackImage = req.files.cnicBackImage[0].path;
        }
        
        // Create employee
        const employee = await Employee.create(employeeData);
        
        // Default avatar URL
        const defaultAvatar = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
        
        // Default CNIC image URL
        const defaultCnicImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23f0f0f0"/%3E%3Ctext x="50" y="55" text-anchor="middle" font-size="10" fill="%23999"%3ECNIC Image%3C/text%3E%3C/svg%3E';
        
        // Format date for response
        const formatDateForResponse = (date) => {
            if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
            
            const day = date.getUTCDate().toString().padStart(2, '0');
            const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
            const year = date.getUTCFullYear();
            
            return `${day}/${month}/${year}`;
        };
        
        // Format response
        const formattedEmployee = {
            _id: employee._id,
            id: employee.employeeId,
            employeeId: employee.employeeId,
            name: employee.name,
            title: employee.title,
            department: employee.department,
            email: employee.email,
            phone: employee.phone,
            startTime: employee.startTime,
            endTime: employee.endTime,
            schedule: employee.schedule,
            salary: `Rs. ${employee.salary?.toLocaleString() || '0'}`,
            avatar: employee.avatar ? getFileUrl(req, employee.avatar) : defaultAvatar,
            cnicFrontImage: employee.cnicFrontImage ? getFileUrl(req, employee.cnicFrontImage) : defaultCnicImage,
            cnicBackImage: employee.cnicBackImage ? getFileUrl(req, employee.cnicBackImage) : defaultCnicImage,
            address: employee.address || '',
            cnic: employee.cnic || '',
            dob: formatDateForResponse(employee.dob),
            emergencyContact: employee.emergencyContact || '',
            reportingManager: employee.reportingManager || '',
            hireDate: formatDateForResponse(employee.hireDate),
            responsibilities: employee.responsibilities || '',
            advancePayment: employee.advancePayment || 0,
            isActive: employee.isActive,
            createdAt: employee.createdAt,
            updatedAt: employee.updatedAt
        };
        
        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            data: formattedEmployee
        });
    } catch (error) {
        // Delete uploaded files if error occurs
        if (req.files) {
            Object.values(req.files).forEach(fileArray => {
                if (Array.isArray(fileArray)) {
                    fileArray.forEach(file => deleteFile(file.path));
                }
            });
        }
        
        console.error('Error creating employee:', error);
        
        let errorMessage = 'Error creating employee';
        
        if (error.name === 'ValidationError') {
            // Handle mongoose validation errors
            const errors = Object.values(error.errors).map(err => err.message);
            errorMessage = `Validation error: ${errors.join(', ')}`;
        } else if (error.code === 11000) {
            // Handle duplicate key errors
            errorMessage = 'Duplicate entry found. Employee ID, Email or CNIC already exists.';
        }
        
        res.status(500).json({
            success: false,
            message: errorMessage,
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
    
    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    // Find existing employee first
    const existingEmployee = await Employee.findById(id);
    if (!existingEmployee) {
      // Delete uploaded files if employee not found
      if (req.files) {
        Object.values(req.files).forEach(fileArray => {
          if (Array.isArray(fileArray)) {
            fileArray.forEach(file => deleteFile(file.path));
          }
        });
      }
      
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    console.log('Update request body:', req.body);
    console.log('Update request files:', req.files);

    // ============= DATE PARSING FUNCTION =============
    const parseDateString = (dateString) => {
      if (!dateString || dateString.trim() === '') return null;
      
      dateString = dateString.trim();
      
      console.log('Parsing date string:', dateString);
      
      // Handle DD/MM/YYYY format
      if (dateString.includes('/')) {
        const parts = dateString.split('/');
        
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const year = parseInt(parts[2], 10);
          
          console.log('DD/MM/YYYY parsed:', { day, month, year });
          
          if (!isNaN(day) && !isNaN(month) && !isNaN(year) && 
              day >= 1 && day <= 31 && 
              month >= 1 && month <= 12 &&
              year >= 1900 && year <= 2100) {
            
            // Create date in UTC to avoid timezone issues
            const date = new Date(Date.UTC(year, month - 1, day));
            
            // Additional validation
            if (date.getUTCFullYear() === year && 
                date.getUTCMonth() === month - 1 && 
                date.getUTCDate() === day) {
              console.log('Valid date created:', date.toISOString());
              return date;
            }
          }
        }
      }
      
      console.log('Could not parse date, returning null');
      return null;
    };

    // Prepare update data
    const updateData = {
      ...req.body,
      // Parse dates
      dob: req.body.dob ? parseDateString(req.body.dob) : existingEmployee.dob,
      hireDate: req.body.hireDate ? parseDateString(req.body.hireDate) : existingEmployee.hireDate,
      // Handle numeric conversions
      salary: req.body.salary ? parseFloat(req.body.salary.replace(/[^0-9.-]+/g, "")) || existingEmployee.salary : existingEmployee.salary,
      advancePayment: req.body.advancePayment !== undefined ? parseFloat(req.body.advancePayment) || 0 : existingEmployee.advancePayment,
      // Handle strings
      name: req.body.name || existingEmployee.name,
      address: req.body.address !== undefined ? req.body.address : existingEmployee.address,
      phone: req.body.phone || existingEmployee.phone,
      email: req.body.email || existingEmployee.email,
      cnic: req.body.cnic || existingEmployee.cnic,
      emergencyContact: req.body.emergencyContact !== undefined ? req.body.emergencyContact : existingEmployee.emergencyContact,
      title: req.body.title !== undefined ? req.body.title : existingEmployee.title,
      department: req.body.department !== undefined ? req.body.department : existingEmployee.department,
      reportingManager: req.body.reportingManager !== undefined ? req.body.reportingManager : existingEmployee.reportingManager,
      responsibilities: req.body.responsibilities !== undefined ? req.body.responsibilities : existingEmployee.responsibilities,
      startTime: req.body.startTime || existingEmployee.startTime || "09:00",
      endTime: req.body.endTime || existingEmployee.endTime || "17:00",
      isActive: req.body.isActive !== undefined ? req.body.isActive : existingEmployee.isActive !== undefined ? existingEmployee.isActive : true,
    };

    console.log('Update data prepared:', updateData);

    // Handle file uploads
    if (req.files) {
      // Handle avatar
      if (req.files.avatar && req.files.avatar[0]) {
        // Delete old avatar if exists
        if (existingEmployee.avatar) {
          deleteFile(existingEmployee.avatar);
        }
        updateData.avatar = req.files.avatar[0].path;
      }
      
      // Handle CNIC Front Image
      if (req.files.cnicFrontImage && req.files.cnicFrontImage[0]) {
        // Delete old CNIC front image if exists
        if (existingEmployee.cnicFrontImage) {
          deleteFile(existingEmployee.cnicFrontImage);
        }
        updateData.cnicFrontImage = req.files.cnicFrontImage[0].path;
      }
      
      // Handle CNIC Back Image
      if (req.files.cnicBackImage && req.files.cnicBackImage[0]) {
        // Delete old CNIC back image if exists
        if (existingEmployee.cnicBackImage) {
          deleteFile(existingEmployee.cnicBackImage);
        }
        updateData.cnicBackImage = req.files.cnicBackImage[0].path;
      }
    }

    // Check for duplicate email if email is being changed
    if (req.body.email && req.body.email !== existingEmployee.email) {
      const existingEmail = await Employee.findOne({ 
        email: req.body.email,
        _id: { $ne: id } // Exclude current employee
      });
      
      if (existingEmail) {
        // Delete uploaded files if email already exists
        if (req.files) {
          Object.values(req.files).forEach(fileArray => {
            if (Array.isArray(fileArray)) {
              fileArray.forEach(file => deleteFile(file.path));
            }
          });
        }
        
        return res.status(400).json({
          success: false,
          message: "Email already exists"
        });
      }
    }

    // Check for duplicate CNIC if CNIC is being changed
    if (req.body.cnic && req.body.cnic !== existingEmployee.cnic) {
      const existingCNIC = await Employee.findOne({ 
        cnic: req.body.cnic,
        _id: { $ne: id } // Exclude current employee
      });
      
      if (existingCNIC) {
        // Delete uploaded files if CNIC already exists
        if (req.files) {
          Object.values(req.files).forEach(fileArray => {
            if (Array.isArray(fileArray)) {
              fileArray.forEach(file => deleteFile(file.path));
            }
          });
        }
        
        return res.status(400).json({
          success: false,
          message: "CNIC already exists"
        });
      }
    }

    // Update employee
    const employee = await Employee.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!employee) {
      // Delete uploaded files if update failed
      if (req.files) {
        Object.values(req.files).forEach(fileArray => {
          if (Array.isArray(fileArray)) {
            fileArray.forEach(file => deleteFile(file.path));
          }
        });
      }
      
      return res.status(500).json({
        success: false,
        message: "Failed to update employee",
      });
    }

    // Default URLs
    const defaultAvatar = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
    const defaultCnicImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23f0f0f0"/%3E%3Ctext x="50" y="55" text-anchor="middle" font-size="10" fill="%23999"%3ECNIC Image%3C/text%3E%3C/svg%3E';

    // Format date for response
    const formatDateForResponse = (date) => {
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
      
      const day = date.getUTCDate().toString().padStart(2, '0');
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const year = date.getUTCFullYear();
      
      return `${day}/${month}/${year}`;
    };

    // Format the response
    const formattedEmployee = {
      _id: employee._id,
      id: employee.employeeId,
      employeeId: employee.employeeId,
      name: employee.name,
      title: employee.title || "",
      department: employee.department || "",
      email: employee.email,
      phone: employee.phone,
      startTime: employee.startTime || "09:00",
      endTime: employee.endTime || "17:00",
      schedule: employee.schedule || "",
      salary: `Rs. ${employee.salary?.toLocaleString() || '0'}`,
      avatar: employee.avatar ? getFileUrl(req, employee.avatar) : defaultAvatar,
      cnicFrontImage: employee.cnicFrontImage ? getFileUrl(req, employee.cnicFrontImage) : defaultCnicImage,
      cnicBackImage: employee.cnicBackImage ? getFileUrl(req, employee.cnicBackImage) : defaultCnicImage,
      address: employee.address || "",
      cnic: employee.cnic || "",
      dob: formatDateForResponse(employee.dob),
      emergencyContact: employee.emergencyContact || "",
      reportingManager: employee.reportingManager || "",
      hireDate: formatDateForResponse(employee.hireDate),
      responsibilities: employee.responsibilities || "",
      advancePayment: employee.advancePayment || 0,
      isActive: employee.isActive || true,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt
    };

    console.log('Employee updated successfully:', formattedEmployee);

    res.json({
      success: true,
      message: "Employee updated successfully",
      data: formattedEmployee,
    });
  } catch (error) {
    console.error("Error updating employee:", error);

    // Delete uploaded files if error occurs
    if (req.files) {
      Object.values(req.files).forEach(fileArray => {
        if (Array.isArray(fileArray)) {
          fileArray.forEach(file => deleteFile(file.path));
        }
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      let field = Object.keys(error.keyPattern)[0];
      let fieldName = field === 'employeeId' ? 'Employee ID' : 
                     field === 'email' ? 'Email' : 
                     field === 'cnic' ? 'CNIC' : field;
      
      return res.status(400).json({
        success: false,
        message: `${fieldName} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while updating employee",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
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