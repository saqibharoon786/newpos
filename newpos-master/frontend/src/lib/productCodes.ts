/** Standard product codes for Mara Ha International Plastic */
export const PRODUCT_CODES = [
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

export function getProductByCode(code: string) {
  return PRODUCT_CODES.find((p) => p.code === code);
}

/** Material name auto-filled in POP when user selects a product code */
export function getMaterialNameForCode(code: string): string {
  const product = getProductByCode(code);
  return product?.materialName || product?.name || '';
}
