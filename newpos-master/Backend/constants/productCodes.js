const PRODUCT_CODES = [
  {
    code: '100',
    name: 'HD',
    materialName: 'HD Pipe',
    bagSize: 30,
    label: '100 – HD Pipe',
  },
  {
    code: '105',
    name: 'Natural/Dodya',
    materialName: 'Natural/Dodya',
    bagSize: 40,
    label: '105 – Natural/Dodya',
  },
  {
    code: '110',
    name: 'PP',
    materialName: 'PP',
    bagSize: 25,
    label: '110 – PP',
  },
];

function getMaterialNameForCode(code) {
  const product = PRODUCT_CODES.find((p) => p.code === code);
  return product?.materialName || product?.name || '';
}

function getBagSizeForCode(code) {
  const product = PRODUCT_CODES.find((p) => p.code === String(code || '').trim());
  return product?.bagSize || 0;
}

function getMaxBagsFromAvailableKg(code, availableKg) {
  const bagSize = getBagSizeForCode(code);
  const kg = parseFloat(availableKg);
  if (!bagSize || !kg || kg <= 0) return 0;
  return Math.round((kg / bagSize) * 100) / 100;
}

function calcWeightFromBags(code, bags) {
  const bagSize = getBagSizeForCode(code);
  const b = parseFloat(bags);
  if (!bagSize || !b || b <= 0) return 0;
  return Math.round(b * bagSize * 100) / 100;
}

module.exports = {
  PRODUCT_CODES,
  getMaterialNameForCode,
  getBagSizeForCode,
  getMaxBagsFromAvailableKg,
  calcWeightFromBags,
};
