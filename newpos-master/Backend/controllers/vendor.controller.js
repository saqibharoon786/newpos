const Vendor = require('../models/vendor.model');
const { getMaterialNameForCode } = require('../constants/productCodes');

function normalizeMaterials(materials) {
  if (!Array.isArray(materials)) return [];
  return materials
    .filter((m) => m && (m.materialName?.trim() || m.productCode?.trim()))
    .map((m) => {
      const productCode = String(m.productCode || '').trim();
      const materialName =
        String(m.materialName || '').trim() ||
        getMaterialNameForCode(productCode) ||
        '';
      return {
        productCode,
        materialName,
        pricePerKg: Math.max(0, Number(m.pricePerKg) || 0),
        defaultWeight: Math.max(0, Number(m.defaultWeight ?? m.weight) || 0),
      };
    });
}

exports.getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ name: 1 }).lean();
    res.json({ success: true, data: vendors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVendorById = async (req, res) => {
  try {
    let vendor = await Vendor.findById(req.params.id).lean();
    if (!vendor && req.params.id.startsWith('VEND-')) {
      vendor = await Vendor.findOne({ vendorId: req.params.id }).lean();
    }
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createVendor = async (req, res) => {
  try {
    const { name, phone, address, materials } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Vendor name required' });
    }
    const trimmedName = name.trim();
    const existing = await Vendor.findOne({ name: trimmedName });
    if (existing) {
      return res.json({ success: true, data: existing, message: 'Vendor already exists' });
    }
    const vendor = await Vendor.create({
      name: trimmedName,
      phone: phone || '',
      address: address || '',
      materials: normalizeMaterials(materials),
    });
    res.status(201).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateVendor = async (req, res) => {
  try {
    const { name, phone, address, materials } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    if (name?.trim() && name.trim() !== vendor.name) {
      const duplicate = await Vendor.findOne({ name: name.trim(), _id: { $ne: vendor._id } });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Vendor name already in use' });
      }
      vendor.name = name.trim();
    }
    if (phone !== undefined) vendor.phone = phone || '';
    if (address !== undefined) vendor.address = address || '';
    if (materials !== undefined) {
      vendor.materials = normalizeMaterials(materials);
    }
    await vendor.save();
    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.json({ success: true, message: 'Vendor deleted' });
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
