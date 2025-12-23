const Customer = require('../models/customer.model');
const { v4: uuidv4 } = require('uuid');

// Helper function to validate file size for base64
const validateFileSize = (base64String, maxSizeMB) => {
  try {
    const sizeInBytes = Buffer.from(base64String.split(',')[1] || base64String, 'base64').length;
    return sizeInBytes <= maxSizeMB * 1024 * 1024;
  } catch (error) {
    return false;
  }
};

// Helper to extract file type and validate
const validateImage = (base64String) => {
  const matches = base64String.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/);
  if (!matches) {
    return { isValid: false, error: 'Invalid image format. Use PNG or JPEG' };
  }
  return { isValid: true, type: matches[1], data: matches[3] };
};

// Helper to generate customer ID
const generateCustomerId = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(10000 + Math.random() * 90000);
  return `CUST-${dateStr}-${random}`;
};

// Create a new customer
exports.createCustomer = async (req, res) => {
  try {
    const {
      customerName,
      phoneNo,
      email,
      cnicNo,
      registrationDate,
      address,
      province,
      city,
      photo,
      documents
    } = req.body;

    // Validate required fields
    if (!customerName || !phoneNo) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and phone number are required'
      });
    }

    // Check for duplicates
    const existingCustomer = await Customer.findOne({
      $or: [
        { phoneNo },
        ...(cnicNo ? [{ cnicNo }] : []),
        ...(email ? [{ email }] : [])
      ]
    });

    if (existingCustomer) {
      let message = '';
      if (existingCustomer.phoneNo === phoneNo) {
        message = 'Phone number already exists';
      } else if (existingCustomer.cnicNo === cnicNo) {
        message = 'CNIC number already exists';
      } else {
        message = 'Email already exists';
      }
      
      return res.status(400).json({
        success: false,
        message
      });
    }

    // Validate photo if provided
    let processedPhoto = null;
    if (photo) {
      const validation = validateImage(photo);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }
      
      if (!validateFileSize(photo, 1)) {
        return res.status(400).json({
          success: false,
          message: 'Photo must be less than 1MB'
        });
      }
      
      processedPhoto = photo; // Store as base64 string
    }

    // Validate documents if provided
    let processedDocuments = [];
    if (documents && Array.isArray(documents)) {
      for (const doc of documents) {
        if (!validateFileSize(doc, 1.5)) {
          return res.status(400).json({
            success: false,
            message: 'Each document must be less than 1.5MB'
          });
        }
        processedDocuments.push(doc); // Store as base64 string
      }
    }

    // Create customer
    const customerData = {
      customerName,
      phoneNo,
      email: email || '',
      cnicNo: cnicNo || '',
      registrationDate: registrationDate || new Date(),
      address: address || '',
      province: province || '',
      city: city || '',
      photo: processedPhoto,
      documents: processedDocuments
    };

    const customer = new Customer(customerData);
    await customer.save();

    // Return response without heavy base64 data
    const response = customer.toObject();
    response.photo = response.photo ? 'Base64 image data' : null;
    response.documents = response.documents?.map(() => 'Base64 document data');

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: response
    });

  } catch (error) {
    console.error('Create customer error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate value found. Customer ID, CNIC or email may already exist.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all customers with filters and pagination
exports.getAllCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      province = '',
      city = '',
      isActive = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerId: { $regex: search, $options: 'i' } },
        { phoneNo: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { cnicNo: { $regex: search, $options: 'i' } }
      ];
    }

    if (province) {
      filter.province = { $regex: province, $options: 'i' };
    }

    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    if (isActive !== '') {
      filter.isActive = isActive === 'true';
    }

    const customers = await Customer.find(filter)
      .select('-photo -documents') // Exclude large base64 fields
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Customer.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      count: customers.length,
      total,
      totalPages,
      currentPage: parseInt(page),
      data: customers,
      filters: {
        search,
        province,
        city,
        isActive
      }
    });

  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single customer by ID
exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if it's customerId or MongoDB _id
    let customer;
    if (id.startsWith('CUST-')) {
      customer = await Customer.findOne({ customerId: id }).select('-photo -documents');
    } else {
      customer = await Customer.findById(id).select('-photo -documents');
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.status(200).json({
      success: true,
      data: customer
    });

  } catch (error) {
    console.error('Get customer error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update customer
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Find customer
    let customer;
    if (id.startsWith('CUST-')) {
      customer = await Customer.findOne({ customerId: id });
    } else {
      customer = await Customer.findById(id);
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check for duplicate phone, email, or cnic
    if (updates.phoneNo || updates.email || updates.cnicNo) {
      const duplicateFilter = {
        _id: { $ne: customer._id }
      };

      const orConditions = [];
      if (updates.phoneNo) orConditions.push({ phoneNo: updates.phoneNo });
      if (updates.email) orConditions.push({ email: updates.email });
      if (updates.cnicNo) orConditions.push({ cnicNo: updates.cnicNo });

      if (orConditions.length > 0) {
        duplicateFilter.$or = orConditions;
        
        const existingCustomer = await Customer.findOne(duplicateFilter);
        if (existingCustomer) {
          let message = '';
          if (existingCustomer.phoneNo === updates.phoneNo) {
            message = 'Phone number already exists';
          } else if (existingCustomer.email === updates.email) {
            message = 'Email already exists';
          } else {
            message = 'CNIC already exists';
          }
          
          return res.status(400).json({
            success: false,
            message
          });
        }
      }
    }

    // Validate photo if updating
    if (updates.photo) {
      const validation = validateImage(updates.photo);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }
      
      if (!validateFileSize(updates.photo, 1)) {
        return res.status(400).json({
          success: false,
          message: 'Photo must be less than 1MB'
        });
      }
    }

    // Validate documents if updating
    if (updates.documents && Array.isArray(updates.documents)) {
      for (const doc of updates.documents) {
        if (!validateFileSize(doc, 1.5)) {
          return res.status(400).json({
            success: false,
            message: 'Each document must be less than 1.5MB'
          });
        }
      }
    }

    // Update customer
    Object.keys(updates).forEach(key => {
      customer[key] = updates[key];
    });

    customer.updatedAt = Date.now();
    await customer.save();

    // Return updated customer without base64 data
    const updatedCustomer = customer.toObject();
    updatedCustomer.photo = updatedCustomer.photo ? 'Base64 image data' : null;
    updatedCustomer.documents = updatedCustomer.documents?.map(() => 'Base64 document data');

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: updatedCustomer
    });

  } catch (error) {
    console.error('Update customer error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update customer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete customer (soft delete)
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    let customer;
    if (id.startsWith('CUST-')) {
      customer = await Customer.findOne({ customerId: id });
    } else {
      customer = await Customer.findById(id);
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Soft delete by setting isActive to false
    customer.isActive = false;
    customer.updatedAt = Date.now();
    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Customer deactivated successfully',
      data: {
        customerId: customer.customerId,
        customerName: customer.customerName,
        isActive: customer.isActive
      }
    });

  } catch (error) {
    console.error('Delete customer error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Activate customer
exports.activateCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    let customer;
    if (id.startsWith('CUST-')) {
      customer = await Customer.findOne({ customerId: id });
    } else {
      customer = await Customer.findById(id);
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    customer.isActive = true;
    customer.updatedAt = Date.now();
    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Customer activated successfully',
      data: {
        customerId: customer.customerId,
        customerName: customer.customerName,
        isActive: customer.isActive
      }
    });

  } catch (error) {
    console.error('Activate customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate customer'
    });
  }
};

// Get customer photo
exports.getCustomerPhoto = async (req, res) => {
  try {
    const { id } = req.params;

    let customer;
    if (id.startsWith('CUST-')) {
      customer = await Customer.findOne({ customerId: id }).select('photo');
    } else {
      customer = await Customer.findById(id).select('photo');
    }

    if (!customer || !customer.photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Parse base64 string
    const matches = customer.photo.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image format'
      });
    }

    const buffer = Buffer.from(matches[3], 'base64');
    
    res.writeHead(200, {
      'Content-Type': matches[1],
      'Content-Length': buffer.length
    });
    
    res.end(buffer);

  } catch (error) {
    console.error('Get photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch photo'
    });
  }
};

// Get customer document
exports.getCustomerDocument = async (req, res) => {
  try {
    const { id, docIndex } = req.params;

    let customer;
    if (id.startsWith('CUST-')) {
      customer = await Customer.findOne({ customerId: id });
    } else {
      customer = await Customer.findById(id);
    }

    if (!customer || !customer.documents || customer.documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const docIndexNum = parseInt(docIndex);
    if (docIndexNum < 0 || docIndexNum >= customer.documents.length) {
      return res.status(404).json({
        success: false,
        message: 'Document index out of range'
      });
    }

    const document = customer.documents[docIndexNum];
    const matches = document.match(/^data:(.+);base64,(.+)$/);
    
    if (!matches) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document format'
      });
    }

    const buffer = Buffer.from(matches[2], 'base64');
    
    res.writeHead(200, {
      'Content-Type': matches[1],
      'Content-Length': buffer.length,
      'Content-Disposition': `attachment; filename="document-${docIndexNum}.${matches[1].split('/')[1]}"`
    });
    
    res.end(buffer);

  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch document'
    });
  }
};

// Get statistics
exports.getCustomerStats = async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const activeCustomers = await Customer.countDocuments({ isActive: true });
    const inactiveCustomers = await Customer.countDocuments({ isActive: false });
    
    // Group by province
    const provinceStats = await Customer.aggregate([
      {
        $group: {
          _id: '$province',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRegistrations = await Customer.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        totalCustomers,
        activeCustomers,
        inactiveCustomers,
        provinceStats,
        recentRegistrations,
        registrationRate: (recentRegistrations / 30).toFixed(2) // per day
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
};

// Export customers (CSV/Excel)
exports.exportCustomers = async (req, res) => {
  try {
    const customers = await Customer.find()
      .select('customerId customerName phoneNo email cnicNo province city registrationDate isActive')
      .sort({ createdAt: -1 });

    // Convert to CSV
    const csvHeaders = [
      'Customer ID',
      'Name',
      'Phone',
      'Email',
      'CNIC',
      'Province',
      'City',
      'Registration Date',
      'Status'
    ];

    const csvRows = customers.map(customer => [
      customer.customerId,
      customer.customerName,
      customer.phoneNo,
      customer.email,
      customer.cnicNo,
      customer.province,
      customer.city,
      customer.registrationDate.toISOString().split('T')[0],
      customer.isActive ? 'Active' : 'Inactive'
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=customers-${Date.now()}.csv`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export customers'
    });
  }
};