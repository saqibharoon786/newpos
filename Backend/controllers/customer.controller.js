const Customer = require('../models/customer.model');
const { asyncHandler } = require("../utils/asyncHandler");

// Create a new customer
exports.createCustomer = asyncHandler(async (req, res) => {
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
    documents,
    amount,
    amountPaid  // ← ADD THIS
  } = req.body;

  // Only check basic required fields
  if (!customerName || !phoneNo) {
    return res.status(400).json({
      success: false,
      message: 'Customer name and phone number are required'
    });
  }

  // Validate amount field
  const totalAmount = parseFloat(amount) || 0;

  if (totalAmount < 0) {
    return res.status(400).json({
      success: false,
      message: 'Total amount cannot be negative'
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
    documents: documents || [],
    amount: totalAmount,
  };

  // Handle amountPaid if provided
  if (typeof amountPaid !== 'undefined') {
    const paidAmountNum = parseFloat(amountPaid) || 0;
    
    if (paidAmountNum < 0) {
      return res.status(400).json({
        success: false,
        message: 'Paid amount cannot be negative'
      });
    }
    
    if (paidAmountNum > totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Paid amount cannot exceed total amount'
      });
    }
    
    customerData.amountPaid = paidAmountNum;
  }
  // If amountPaid not provided, it defaults to 0 in the model

  const customer = new Customer(customerData);
  await customer.save();

  res.status(201).json({
    success: true,
    message: 'Customer created successfully',
    data: customer
  });
});

// Get all customers with filters and pagination
exports.getAllCustomers = asyncHandler(async (req, res) => {
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
});

// Get single customer by ID
exports.getCustomerById = asyncHandler(async (req, res) => {
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
});

// Update customer
exports.updateCustomer = asyncHandler(async (req, res) => {
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

  // Validate amount fields if they're being updated
  if (updates.amount !== undefined || updates.amountPaid !== undefined) {
    const currentAmount = customer.amount;
    const currentAmountPaid = customer.amountPaid;
    
    const newAmount = updates.amount !== undefined ? parseFloat(updates.amount) : currentAmount;
    const newAmountPaid = updates.amountPaid !== undefined ? parseFloat(updates.amountPaid) : currentAmountPaid;
    
    // Validate new values
    if (newAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Total amount cannot be negative'
      });
    }
    
    if (newAmountPaid < 0) {
      return res.status(400).json({
        success: false,
        message: 'Paid amount cannot be negative'
      });
    }
    
    if (newAmountPaid > newAmount) {
      return res.status(400).json({
        success: false,
        message: 'Paid amount cannot exceed total amount'
      });
    }
  }

  // Update customer fields
  Object.keys(updates).forEach(key => {
    if (key === 'amount' || key === 'amountPaid') {
      // Convert to number if it's a string
      customer[key] = parseFloat(updates[key]);
    } else if (key !== 'paymentStatus') { // Don't allow direct paymentStatus updates
      customer[key] = updates[key];
    }
  });

  // If amount or amountPaid is updated, paymentStatus will be auto-calculated in pre-save
  customer.updatedAt = Date.now();
  await customer.save();

  res.status(200).json({
    success: true,
    message: 'Customer updated successfully',
    data: customer
  });
});

// Delete customer (soft delete)
exports.deleteCustomer = asyncHandler(async (req, res) => {
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
});

// Activate customer
exports.activateCustomer = asyncHandler(async (req, res) => {
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
});

// Get customer photo (separate endpoint if needed)
exports.getCustomerPhoto = asyncHandler(async (req, res) => {
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
});

// Get customer documents (separate endpoint if needed)
exports.getCustomerDocuments = asyncHandler(async (req, res) => {
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
});

// Get statistics
exports.getCustomerStats = asyncHandler(async (req, res) => {
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
});