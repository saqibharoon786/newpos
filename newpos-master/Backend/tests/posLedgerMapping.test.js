const assert = require('assert');
const { createSaleLineItemsWithProductionIds } = require('../controllers/pos.controller');

(async () => {
  const lineItems = [
    { materialName: 'HD Pipe', quality: 'Standard', materialColor: '#FFFFFF', weight: 10, sellingPricePerKg: 100, amount: 1000, productionId: 'prod-1' },
    { materialName: 'PP', quality: 'Standard', materialColor: '#FFFFFF', weight: 5, sellingPricePerKg: 90, amount: 450, productionId: 'prod-2' },
  ];

  const result = await createSaleLineItemsWithProductionIds(lineItems, [{ _id: 'prod-1', productCode: '100', materialName: 'HD Pipe', quality: 'Standard', color: '#FFFFFF', availableWeight: 20, totalWeight: 20, totalProductionCost: 2000 }, { _id: 'prod-2', productCode: '110', materialName: 'PP', quality: 'Standard', color: '#FFFFFF', availableWeight: 10, totalWeight: 10, totalProductionCost: 900 }]);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].productionId.toString(), 'prod-1');
  assert.strictEqual(result[1].productionId.toString(), 'prod-2');
  console.log('posLedgerMapping test passed');
})();
