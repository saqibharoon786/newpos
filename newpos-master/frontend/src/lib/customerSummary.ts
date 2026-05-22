/** Shared customer-wise summary from POS sales */

export interface SaleForSummary {
  buyerName?: string;
  finalAmount?: string;
  sellingPrice?: string;
  amountPaid?: number;
  remainingAmount?: number;
  weight?: string;
  unit?: string;
  quality?: string;
  materialName?: string;
  materialColor?: string;
}

export interface CustomerSummaryRow {
  customerName: string;
  sales: number;
  totalAmount: number;
  amountPaid: number;
  remainingAmount: number;
  weight: number;
  units: number;
  qualities: string[];
  colors: string[];
  qualityWeight: Record<string, number>;
  qualityPaid: Record<string, number>;
  materialPaid: Record<string, number>;
}

export function buildCustomerSummaryFromSales(
  sales: SaleForSummary[]
): CustomerSummaryRow[] {
  const byCustomer: Record<
    string,
    {
      sales: number;
      totalAmount: number;
      amountPaid: number;
      remainingAmount: number;
      weight: number;
      units: number;
      qualities: Set<string>;
      colors: Set<string>;
      qualityWeight: Record<string, number>;
      qualityPaid: Record<string, number>;
      materialPaid: Record<string, number>;
    }
  > = {};

  sales.forEach((sale) => {
    const name = (sale.buyerName || "Unknown").trim() || "Unknown";
    const totalAmount = parseFloat(sale.finalAmount || sale.sellingPrice || "0") || 0;
    const paid = sale.amountPaid || 0;
    const remaining = sale.remainingAmount || 0;
    const weight = parseFloat(sale.weight || "0") || 0;
    const units = parseInt(sale.unit || "0", 10) || 0;
    const quality = (sale.quality || "Unknown").trim() || "Unknown";
    const materialName = (sale.materialName || "Unknown").trim() || "Unknown";
    const colorHex = sale.materialColor?.trim() || "";

    if (!byCustomer[name]) {
      byCustomer[name] = {
        sales: 0,
        totalAmount: 0,
        amountPaid: 0,
        remainingAmount: 0,
        weight: 0,
        units: 0,
        qualities: new Set<string>(),
        colors: new Set<string>(),
        qualityWeight: {},
        qualityPaid: {},
        materialPaid: {},
      };
    }

    const row = byCustomer[name];
    row.sales += 1;
    row.totalAmount += totalAmount;
    row.amountPaid += paid;
    row.remainingAmount += remaining;
    row.weight += weight;
    row.units += units;
    if (quality) row.qualities.add(quality);
    if (colorHex) row.colors.add(colorHex);
    row.qualityWeight[quality] = (row.qualityWeight[quality] || 0) + weight;
    row.qualityPaid[quality] = (row.qualityPaid[quality] || 0) + paid;
    row.materialPaid[materialName] = (row.materialPaid[materialName] || 0) + paid;
  });

  return Object.entries(byCustomer)
    .map(([customerName, data]) => ({
      customerName,
      sales: data.sales,
      totalAmount: data.totalAmount,
      amountPaid: data.amountPaid,
      remainingAmount: data.remainingAmount,
      weight: data.weight,
      units: data.units,
      qualities: Array.from(data.qualities).filter(Boolean).sort(),
      colors: Array.from(data.colors).filter(Boolean),
      qualityWeight: data.qualityWeight,
      qualityPaid: data.qualityPaid,
      materialPaid: data.materialPaid,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export const POS_COLOR_OPTIONS: { name: string; value: string }[] = [
  { name: "White", value: "#FFFFFF" },
  { name: "Yellow", value: "#FACC15" },
  { name: "Red", value: "#EF4444" },
  { name: "Blue", value: "#2563EB" },
  { name: "Orange", value: "#F97316" },
  { name: "Green", value: "#22C55E" },
  { name: "Black", value: "#000000" },
  { name: "Pink", value: "#EC4899" },
  { name: "Purple", value: "#A855F7" },
  { name: "Gray", value: "#6B7280" },
  { name: "Brown", value: "#92400E" },
];

export function getColorNameFromHex(hex: string): string {
  const c = POS_COLOR_OPTIONS.find(
    (o) => (o.value || "").toLowerCase() === (hex || "").toLowerCase()
  );
  return c ? c.name : hex || "—";
}
