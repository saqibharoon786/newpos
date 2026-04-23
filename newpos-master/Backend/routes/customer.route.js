const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');

// IMPORTANT: All routes here are relative to /api/customers

// Customer CRUD routes
router.post('/create-customers', customerController.createCustomer); // POST /api/customers/create-customers
router.get('/getall-customers', customerController.getAllCustomers); // GET /api/customers/getall-customers
router.get('/stats', customerController.getCustomerStats); // GET /api/customers/stats
router.get('/:id', customerController.getCustomerById); // GET /api/customers/:id
router.put('/:id', customerController.updateCustomer); // PUT /api/customers/:id
router.delete('/:id', customerController.deleteCustomer); // DELETE /api/customers/:id
router.put('/:id/activate', customerController.activateCustomer); // PUT /api/customers/:id/activate

// File access routes
router.get('/:id/photo', customerController.getCustomerPhoto); // GET /api/customers/:id/photo
router.get('/:id/documents', customerController.getCustomerDocuments); // GET /api/customers/:id/documents

module.exports = router;