const Vendor = require('../models/vendor.model');
const { getMaterialNameForCode } = require('../constants/productCodes');
const ledgerService = require('../utils/ledgerService');
const { logActivity } = require('../utils/activityLogger');
const { cascadeDeleteVendor } = require('../utils/productionCascadeDelete');

const LEDGER_ALL_TIME = { startDate: '1970-01-01', endDate: '2099-12-31' };

async function attachLedgerBalances(vendor) {
  const ledger = await ledgerService.getVendorLedger(String(vendor._id), LEDGER_ALL_TIME);
  return {
    ...vendor,
    ledgerClosingBalance: ledger?.closingBalance ?? 0,
    ledgerOpeningBalance: ledger?.openingBalance ?? 0,
    ledgerAdvanceBalance: ledger?.advanceBalance ?? vendor.advanceBalance ?? 0,
  };
}

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
    const withLedger = req.query.withLedger === '1' || req.query.withLedger === 'true';
    const data = withLedger
      ? await Promise.all(vendors.map((v) => attachLedgerBalances(v)))
      : vendors;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVendorLedgerBalances = async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ name: 1 }).lean();
    const data = await Promise.all(vendors.map((v) => attachLedgerBalances(v)));
    res.json({ success: true, data });
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
    const data = await attachLedgerBalances(vendor);
    res.json({ success: true, data });
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
    const result = await cascadeDeleteVendor(req.params.id);
    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
      });
    }

    try {
      await logActivity({
        userId: req.user?._id,
        userName: req.user?.username || req.user?.email || 'system',
        action: 'Delete',
        module: 'Vendor',
        recordId: result.summary.vendorId,
        beforeValues: result.vendor,
        afterValues: { cascade: result.summary },
        req,
      });
    } catch (_) {
      /* ignore log errors */
    }

    res.json({
      success: true,
      message: result.message,
      summary: result.summary,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete vendor' });
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

/** How much vendor advance to apply on a new POP bill */
exports.resolveAdvanceForPurchase = (vendor, priceNum, requestedAdvance) => {
  const price = parseFloat(priceNum) || 0;
  const requested = parseFloat(requestedAdvance) || 0;
  const available = Math.max(0, Number(vendor?.advanceBalance) || 0);
  if (price <= 0 || available <= 0) return 0;
  if (requested <= 0) return Math.min(available, price);
  return Math.min(requested, available, price);
};

exports.updateVendorLedger = async (vendorName, entry) => {
  const vendor = await exports.getVendorByName(vendorName);
  const lastBalance = vendor.ledger.length
    ? vendor.ledger[vendor.ledger.length - 1].balance
    : vendor.payableBalance - vendor.advanceBalance;

  let newBalance = lastBalance;
  const credit = Number(entry.credit) || 0;
  const debit = Number(entry.debit) || 0;

  if (entry.type === 'purchase') {
    newBalance += credit;
    vendor.payableBalance += credit;
  } else if (entry.type === 'payment') {
    newBalance -= debit;
    vendor.payableBalance = Math.max(0, vendor.payableBalance - debit);
  } else if (entry.type === 'advance') {
    newBalance -= debit;
    vendor.advanceBalance += debit;
  } else if (entry.type === 'apply_advance') {
    const applied = Math.min(debit, vendor.advanceBalance, vendor.payableBalance);
    // Don't subtract applied from newBalance since it's just an internal offset!
    vendor.advanceBalance = Math.max(0, vendor.advanceBalance - applied);
    vendor.payableBalance = Math.max(0, vendor.payableBalance - applied);
    entry.debit = applied;
    entry.credit = 0;
  } else if (entry.type === 'adjustment') {
    newBalance += credit - debit;
  }

  vendor.ledger.push({ ...entry, balance: newBalance });
  await vendor.save();
  return vendor;
};
