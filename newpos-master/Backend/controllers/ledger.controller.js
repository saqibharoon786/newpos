const ledgerService = require('../utils/ledgerService');
const Vendor = require('../models/vendor.model');
const Customer = require('../models/customer.model');
const Employee = require('../models/employee.model');

exports.getMeta = async (req, res) => {
  try {
    const range = ledgerService.resolveRange(req.query);
    const [vendors, customers, employees] = await Promise.all([
      Vendor.find().select('_id name').sort({ name: 1 }).lean(),
      Customer.find().select('_id customerName customerId').sort({ customerName: 1 }).limit(500).lean(),
      Employee.find({ isActive: true }).select('_id name employeeId').sort({ name: 1 }).lean(),
    ]);
    res.json({
      success: true,
      defaultRange: range,
      vendors: vendors.map((v) => ({ _id: v._id, name: v.name })),
      customers: customers.map((c) => ({
        _id: c._id,
        name: c.customerName,
        customerId: c.customerId,
      })),
      employees: employees.map((e) => ({
        _id: e._id,
        name: e.name,
        employeeId: e.employeeId,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRmSummary = async (req, res) => {
  try {
    const data = await ledgerService.getRmSummary(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRmDetail = async (req, res) => {
  try {
    const data = await ledgerService.getRmDetail(req.params.code, req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFpSummary = async (req, res) => {
  try {
    const data = await ledgerService.getFpSummary(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFpDetail = async (req, res) => {
  try {
    const data = await ledgerService.getFpDetail(req.params.code, req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPurchaseLedger = async (req, res) => {
  try {
    const data = await ledgerService.getPurchaseTransactionLedger(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSalesLedger = async (req, res) => {
  try {
    const data = await ledgerService.getSalesTransactionLedger(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVendorLedger = async (req, res) => {
  try {
    const data = await ledgerService.getVendorLedger(req.params.vendorId, req.query);
    if (!data) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCustomerLedger = async (req, res) => {
  try {
    const data = await ledgerService.getCustomerLedger(req.params.customerId, req.query);
    if (!data) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOwnerAdvanceLedger = async (req, res) => {
  try {
    const data = await ledgerService.getOwnerAdvanceLedger(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEmployeeAdvanceLedger = async (req, res) => {
  try {
    const data = await ledgerService.getEmployeeAdvanceLedger(req.params.employeeId, req.query);
    if (!data) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
