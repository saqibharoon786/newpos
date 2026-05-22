/** Shared production cost calculation (POP material + waste + labor) */

export type ProductionCostInput = {
  purchasePrice?: number;
  purchaseWeight?: number;
  weightUsedFromPOP?: number;
  outputWeight?: number;
  wasteWeight?: number;
  wasteCost?: number;
  laborCostPerKg?: number;
  materialCost?: number;
};

export function computeProductionCosts(input: ProductionCostInput) {
  const purchasePrice = Number(input.purchasePrice) || 0;
  const purchaseWeight = Number(input.purchaseWeight) || 0;
  const weightUsedFromPOP = Number(input.weightUsedFromPOP) || 0;
  const outputWeight = Number(input.outputWeight) || 0;
  const wasteWeight = Number(input.wasteWeight) || 0;

  const pricePerKg = purchasePrice > 0 && purchaseWeight > 0 ? purchasePrice / purchaseWeight : 0;

  let materialCost = Number(input.materialCost) || 0;
  if (!materialCost && pricePerKg > 0) {
    // Finished product only — waste is costed separately (no double count)
    const materialKg =
      outputWeight > 0
        ? outputWeight
        : Math.max(0, weightUsedFromPOP - wasteWeight);
    if (materialKg > 0) {
      materialCost = pricePerKg * materialKg;
    }
  }

  let wasteCost = Number(input.wasteCost) || 0;
  if (!wasteCost && wasteWeight > 0 && pricePerKg > 0) {
    wasteCost = pricePerKg * wasteWeight;
  }

  const laborCostPerKg = Number(input.laborCostPerKg) || 0;
  const laborCost = laborCostPerKg * (outputWeight > 0 ? outputWeight : weightUsedFromPOP);

  const totalProductionCost = materialCost + wasteCost + laborCost;

  return {
    materialCost: Math.round(materialCost * 100) / 100,
    wasteCost: Math.round(wasteCost * 100) / 100,
    laborCost: Math.round(laborCost * 100) / 100,
    totalProductionCost: Math.round(totalProductionCost * 100) / 100,
  };
}

/** Waste cost (Rs.) = POP price per kg × waste kg */
export function calcWasteCostFromPop(
  purchasePrice: number,
  purchaseWeight: number,
  wasteWeight: number
): number {
  const price = Number(purchasePrice) || 0;
  const weight = Number(purchaseWeight) || 0;
  const waste = Number(wasteWeight) || 0;
  if (price <= 0 || weight <= 0 || waste <= 0) return 0;
  return Math.round((price / weight) * waste * 100) / 100;
}

export function getPricePerKgFromPop(purchasePrice: number, purchaseWeight: number): number {
  const price = Number(purchasePrice) || 0;
  const weight = Number(purchaseWeight) || 0;
  if (price <= 0 || weight <= 0) return 0;
  return Math.round((price / weight) * 100) / 100;
}

/**
 * Process queue preview + production history list use the same rules:
 * POP price/kg × output kg (material), POP price/kg × waste kg (waste), labor × output.
 */
export function computeProcessQueueCosts(input: ProductionCostInput) {
  return computeProductionCosts({
    purchasePrice: input.purchasePrice,
    purchaseWeight: input.purchaseWeight,
    weightUsedFromPOP: input.weightUsedFromPOP,
    outputWeight: input.outputWeight,
    wasteWeight: input.wasteWeight,
    laborCostPerKg: input.laborCostPerKg,
  });
}

export function getProductionDisplayCost(record: {
  totalProductionCost?: number;
  materialCost?: number;
  wasteCost?: number;
  laborCost?: number;
  laborCostPerKg?: number;
  outputWeight?: number;
  weightUsedFromPOP?: number;
  wasteWeight?: number;
  purchasePrice?: number;
  purchaseWeight?: number;
}): number {
  const purchasePrice = Number(record.purchasePrice) || 0;
  const purchaseWeight = Number(record.purchaseWeight) || 0;
  if (purchasePrice > 0 && purchaseWeight > 0) {
    return computeProductionCosts({
      purchasePrice,
      purchaseWeight,
      weightUsedFromPOP: record.weightUsedFromPOP,
      outputWeight: record.outputWeight,
      wasteWeight: record.wasteWeight,
      laborCostPerKg: record.laborCostPerKg,
    }).totalProductionCost;
  }
  const mat = Number(record.materialCost) || 0;
  const waste = Number(record.wasteCost) || 0;
  const labor = Number(record.laborCost) || 0;
  if (mat + waste + labor > 0) return Math.round((mat + waste + labor) * 100) / 100;
  const stored = Number(record.totalProductionCost) || 0;
  if (stored > 0) return stored;
  return computeProductionCosts({
    weightUsedFromPOP: record.weightUsedFromPOP,
    outputWeight: record.outputWeight,
    wasteWeight: record.wasteWeight,
    laborCostPerKg: record.laborCostPerKg,
  }).totalProductionCost;
}
