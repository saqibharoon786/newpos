function computeProductionCosts(input) {
  const purchasePrice = Number(input.purchasePrice) || 0;
  const purchaseWeight = Number(input.purchaseWeight) || 0;
  const weightUsedFromPOP = Number(input.weightUsedFromPOP) || 0;
  const outputWeight = Number(input.outputWeight) || 0;
  const wasteWeight = Number(input.wasteWeight) || 0;

  const pricePerKg =
    purchasePrice > 0 && purchaseWeight > 0 ? purchasePrice / purchaseWeight : 0;

  let materialCost = Number(input.materialCost) || 0;
  if (!materialCost && pricePerKg > 0) {
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

module.exports = { computeProductionCosts };
