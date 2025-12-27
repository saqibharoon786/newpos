const Customer = require('../models/customer.model');

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

    // Only check basic required fields
    if (!customerName || !phoneNo) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and phone number are required'
      });
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
      photo: photo || null,
      documents: documents || []
    };

    const customer = new Customer(customerData);
    await customer.save();

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer
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
      limit = 50,
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
      data: customers
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

    // Update customer
    Object.keys(updates).forEach(key => {
      customer[key] = updates[key];
    });

    customer.updatedAt = Date.now();
    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: customer
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

    // Hard delete
    await customer.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Customer deleted successfully'
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

// Get customer photo (separate endpoint if needed)
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

    res.status(200).json({
      success: true,
      data: customer.photo
    });

  } catch (error) {
    console.error('Get photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch photo'
    });
  }
};

// Get customer documents (separate endpoint if needed)
exports.getCustomerDocuments = async (req, res) => {
  try {
    const { id } = req.params;

    let customer;
    if (id.startsWith('CUST-')) {
      customer = await Customer.findOne({ customerId: id }).select('documents');
    } else {
      customer = await Customer.findById(id).select('documents');
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.status(200).json({
      success: true,
      data: customer.documents || []
    });

  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents'
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

    res.status(200).json({
      success: true,
      data: {
        totalCustomers,
        activeCustomers,
        inactiveCustomers,
        provinceStats
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