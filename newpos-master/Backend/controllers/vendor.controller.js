const Vendor = require('../models/vendor.model');

exports.getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ name: 1 }).lean();
    res.json({ success: true, data: vendors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createVendor = async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Vendor name required' });
    }
    const existing = await Vendor.findOne({ name: name.trim() });
    if (existing) {
      return res.json({ success: true, data: existing });
    }
    const vendor = await Vendor.create({ name: name.trim(), phone, address });
    res.status(201).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVendorLedger = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).lean();
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVendorByName = async (name) => {
  let vendor = await Vendor.findOne({ name: name.trim() });
  if (!vendor) {
    vendor = await Vendor.create({ name: name.trim() });
  }
  return vendor;
};

exports.updateVendorLedger = async (vendorName, entry) => {
  const vendor = await exports.getVendorByName(vendorName);
  const lastBalance = vendor.ledger.length
    ? vendor.ledger[vendor.ledger.length - 1].balance
    : vendor.payableBalance - vendor.advanceBalance;

  let newBalance = lastBalance;
  if (entry.type === 'purchase') {
    newBalance += entry.debit || 0;
    vendor.payableBalance += entry.debit || 0;
  } else if (entry.type === 'payment' || entry.type === 'advance') {
    newBalance -= entry.credit || 0;
    if (entry.type === 'advance') {
      vendor.advanceBalance += entry.credit || 0;
    } else {
      vendor.payableBalance = Math.max(0, vendor.payableBalance - (entry.credit || 0));
    }
  }

  vendor.ledger.push({ ...entry, balance: newBalance });
  await vendor.save();
  return vendor;
};
