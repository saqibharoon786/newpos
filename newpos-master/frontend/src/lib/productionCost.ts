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

  let materialCost = Number(input.materialCost) || 0;
  if (!materialCost && purchasePrice > 0 && purchaseWeight > 0) {
    const weightBasis = weightUsedFromPOP > 0 ? weightUsedFromPOP : outputWeight;
    if (weightBasis > 0) {
      materialCost = (purchasePrice / purchaseWeight) * weightBasis;
    }
  }

  let wasteCost = Number(input.wasteCost) || 0;
  if (!wasteCost && wasteWeight > 0 && materialCost > 0) {
    const basis = weightUsedFromPOP > 0 ? weightUsedFromPOP : outputWeight || 1;
    wasteCost = wasteWeight * (materialCost / basis);
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

export function getProductionDisplayCost(record: {
  totalProductionCost?: number;
  materialCost?: number;
  wasteCost?: number;
  laborCostPerKg?: number;
  outputWeight?: number;
  weightUsedFromPOP?: number;
  wasteWeight?: number;
  purchasePrice?: number;
  purchaseWeight?: number;
}): number {
  const stored = Number(record.totalProductionCost) || 0;
  if (stored > 0) return stored;
  return computeProductionCosts({
    purchasePrice: record.purchasePrice,
    purchaseWeight: record.purchaseWeight,
    weightUsedFromPOP: record.weightUsedFromPOP,
    outputWeight: record.outputWeight,
    wasteWeight: record.wasteWeight,
    wasteCost: record.wasteCost,
    laborCostPerKg: record.laborCostPerKg,
    materialCost: record.materialCost,
  }).totalProductionCost;
}
