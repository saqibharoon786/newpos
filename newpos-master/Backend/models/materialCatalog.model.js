const mongoose = require('mongoose');

const materialCatalogSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    productCode: { type: String, default: '' },
    unit: { type: String, default: 'kg' },
    defaultPricePerKg: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MaterialCatalog', materialCatalogSchema);
