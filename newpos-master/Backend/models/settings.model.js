const mongoose = require('mongoose');

const companySettingsSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      default: 'International Plastic',
      required: true,
    },
    logo: { type: String, default: null },
    currencySymbol: { type: String, default: 'Rs.' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    backupPath: { type: String, default: './backups' },
    externalBackupPath: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CompanySettings', companySettingsSchema);
