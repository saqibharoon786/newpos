const CompanySettings = require('../models/settings.model');
const { logActivity } = require('../utils/activityLogger');

async function getOrCreateSettings() {
  let settings = await CompanySettings.findOne();
  if (!settings) {
    settings = await CompanySettings.create({
      companyName: 'Mara Ha International Plastic',
      currencySymbol: 'Rs.',
    });
  }
  return settings;
}

exports.getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const before = await getOrCreateSettings();
    const settings = await CompanySettings.findByIdAndUpdate(
      before._id,
      { $set: req.body },
      { new: true }
    );
    await logActivity({
      userId: req.user?.userId || req.user?._id,
      userName: req.user?.username || 'Owner',
      action: 'Edit',
      module: 'Settings',
      recordId: settings._id,
      beforeValues: before.toObject(),
      afterValues: settings.toObject(),
      reason: req.body.reason || '',
      req,
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Logo file required' });
    }
    const settings = await getOrCreateSettings();
    settings.logo = `/uploads/${req.file.filename}`;
    await settings.save();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
