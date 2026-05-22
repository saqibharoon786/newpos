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

type PopMaterialLine = {
  name?: string;
  weight?: number;
  productCode?: string;
  pricePerKg?: number;
  totalAmount?: number;
};

/** Cost rate for production — only the selected product code line on multi-material POP */
export function getPopLinePricingFromPurchase(
  pop: {
    price?: number | string;
    weight?: number | string;
    materials?: PopMaterialLine[];
  },
  productCode: string
): { purchasePrice: number; purchaseWeight: number } {
  const mats = pop.materials || [];
  const code = String(productCode || '').trim();
  if (mats.length > 0 && code) {
    const line = mats.find((m) => String(m.productCode || '').trim() === code);
    if (line) {
      const w = parseFloat(String(line.weight)) || 0;
      const pricePerKg = parseFloat(String(line.pricePerKg)) || 0;
      const totalAmount = parseFloat(String(line.totalAmount)) || 0;
      return {
        purchasePrice: totalAmount > 0 ? totalAmount : pricePerKg * w,
        purchaseWeight: w,
      };
    }
  }
  return {
    purchasePrice: parseFloat(String(pop.price)) || 0,
    purchaseWeight: parseFloat(String(pop.weight)) || 0,
  };
}
