const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');

// Validation middleware
const validateCustomer = (req, res, next) => {
  const { customerName, phoneNo } = req.body;
  
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!customerName || !phoneNo) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and phone number are required'
      });
    }
    
    // Phone validation
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(phoneNo)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10-15 digits'
      });
    }
    
    // Email validation if provided
    if (req.body.email && req.body.email !== '') {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(req.body.email)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address'
        });
      }
    }
    
    // CNIC validation if provided
    if (req.body.cnicNo && req.body.cnicNo !== '') {
      const cnicRegex = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$/;
      if (!cnicRegex.test(req.body.cnicNo)) {
        return res.status(400).json({
          success: false,
          message: 'CNIC must be in format: 12345-6789012-3'
        });
      }
    }
  }
  
  next();
};

// IMPORTANT: All routes here are relative to /api/customers

// Customer CRUD routes
router.post('/create-customers', validateCustomer, customerController.createCustomer); // POST /api/customers/create-customers
router.get('/getall-customers', customerController.getAllCustomers); // GET /api/customers/getall-customers
router.get('/stats', customerController.getCustomerStats); // GET /api/customers/stats
router.get('/export', customerController.exportCustomers); // GET /api/customers/export
router.get('/:id', customerController.getCustomerById); // GET /api/customers/:id
router.put('/:id', validateCustomer, customerController.updateCustomer); // PUT /api/customers/:id
router.delete('/:id', customerController.deleteCustomer); // DELETE /api/customers/:id
router.put('/:id/activate', customerController.activateCustomer); // PUT /api/customers/:id/activate

// File access routes
router.get('/:id/photo', customerController.getCustomerPhoto); // GET /api/customers/:id/photo
router.get('/:id/documents/:docIndex', customerController.getCustomerDocument); // GET /api/customers/:id/documents/:docIndex

module.exports = router;