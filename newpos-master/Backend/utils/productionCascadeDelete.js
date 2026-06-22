const Vendor = require('../models/vendor.model');
const Purchase = require('../models/pop.model');
const Sale = require('../models/pos.model');
const { ProductionData, ProcessingMaterial } = require('../models/process.model');
const { restorePopWeight } = require('./popMaterialConsumption');
const {
  deleteSaleRecord,
  reverseSaleFinance,
  cascadeDeletePurchase,
} = require('./purchaseCascadeDelete');

/**
 * Delete production batch and cascade linked POS sales + POP weight restore.
 */
async function cascadeDeleteProduction(productionId) {
  const production = await ProductionData.findById(productionId);
  if (!production) {
    return { ok: false, status: 404, message: 'Production record not found' };
  }

  const summary = {
    productionId: String(production._id),
    batchNo: production.batchNo,
    salesDeleted: 0,
    financeReversals: 0,
    popWeightRestoredKg: 0,
  };

  const linkedSales = await Sale.find({ productionId: production._id }).lean();
  for (const sale of linkedSales) {
    const rev = await reverseSaleFinance(sale);
    if (rev) summary.financeReversals += 1;
    await deleteSaleRecord(sale);
    summary.salesDeleted += 1;
  }

  const used = parseFloat(production.weightUsedFromPOP) || 0;
  if (used > 0 && production.purchaseId && production.productCode) {
    const restore = await restorePopWeight(production.purchaseId, {
      productCode: production.productCode,
      weight: used,
      materialLineIndex: production.materialLineIndex,
    });
    if (restore.ok) summary.popWeightRestoredKg = used;
  }

  await ProcessingMaterial.deleteMany({ batchNo: production.batchNo });

  await ProductionData.findByIdAndDelete(production._id);

  return {
    ok: true,
    message: `Production ${production.batchNo || summary.productionId} deleted`,
    summary,
    production: production.toObject(),
  };
}

/**
 * Delete vendor and cascade-delete all POP purchases for that vendor name.
 */
async function cascadeDeleteVendor(vendorId) {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    return { ok: false, status: 404, message: 'Vendor not found' };
  }

  const purchases = await Purchase.find({ vendor: vendor.name }).lean();
  const summary = {
    vendorId: String(vendor._id),
    vendorName: vendor.name,
    purchasesDeleted: 0,
    salesDeleted: 0,
    productionsDeleted: 0,
  };

  for (const purchase of purchases) {
    const result = await cascadeDeletePurchase(purchase._id);
    if (result.ok) {
      summary.purchasesDeleted += 1;
      summary.salesDeleted += result.summary?.salesDeleted || 0;
      summary.productionsDeleted += result.summary?.productionsDeleted || 0;
    }
  }

  await Vendor.findByIdAndDelete(vendorId);

  return {
    ok: true,
    message: `Vendor "${vendor.name}" deleted`,
    summary,
    vendor: { name: vendor.name, vendorId: vendor.vendorId },
  };
}

module.exports = {
  cascadeDeleteProduction,
  cascadeDeleteVendor,
};
