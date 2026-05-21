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

module.exports = { PRODUCT_CODES, getMaterialNameForCode };
