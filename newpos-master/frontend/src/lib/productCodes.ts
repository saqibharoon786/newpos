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

/** Resolve product code from POP material row or name */
export function resolveProductCode(
  materialName?: string,
  explicitCode?: string
): string {
  const code = String(explicitCode || '').trim();
  if (code) return code;
  const n = String(materialName || '').trim().toLowerCase();
  if (!n) return '';
  for (const p of PRODUCT_CODES) {
    const mn = p.materialName.toLowerCase();
    if (n === mn || n.includes(mn) || mn.includes(n)) return p.code;
  }
  return '';
}

export function getProductCodeLabel(code: string): string {
  const product = getProductByCode(code);
  return product?.label || (code ? `Code ${code}` : '');
}

/** kg per bag: 100 → 30, 105 → 40, 110 → 25 */
export function getBagSizeForCode(code: string): number {
  return getProductByCode(code)?.bagSize ?? 0;
}

/** Total kg from POP = bags × bag size for product code */
export function calcPopWeightFromBags(code: string, bags: number): number {
  const bagSize = getBagSizeForCode(code);
  if (!bagSize || !Number.isFinite(bags) || bags <= 0) return 0;
  return Math.round(bags * bagSize * 100) / 100;
}
