const Purchase = require("../models/pop.model");
const Sale = require("../models/pos.model");
const { asyncHandler } = require("../utils/asyncHandler");

// Add Purchase
const addPurchase = asyncHandler(async (req, res) => {
  try {
    console.log('=== START addPurchase ===');
    
    const {
      vendor,
      price,
      purchaseDate,
      purchaseTime,
      vehicleName,
      vehicleType,
      vehicleNumber,
      driverName,
      vehicleColor,
      deliveryDate,
      deliveryTime,
      receiptNo,
      code,
      advancePayment,
      amountPaid,
      materials: materialsJson // JSON string array
    } = req.body;

    // Parse materials array
    let materialsArray = [];
    try {
      if (materialsJson) {
        materialsArray = JSON.parse(materialsJson);
      }
    } catch (e) {
      console.error('Error parsing materials JSON:', e);
      return res.status(400).json({ success: false, message: "Invalid materials format" });
    }

    if (!materialsArray || materialsArray.length === 0 || !vendor || !price || !purchaseDate) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing: materials, vendor, price, purchaseDate"
      });
    }

    // Convert total price to number
    const totalPriceNum = parseFloat(price) || 0;
    
    // Parse advance payment
    let totalAdvancePaymentNum = 0;
    if (advancePayment !== undefined && advancePayment !== null && advancePayment !== '') {
      totalAdvancePaymentNum = parseFloat(advancePayment) || 0;
    }
    
    // Parse amount paid during purchase
    let totalAmountPaidNum = 0;
    if (amountPaid !== undefined && amountPaid !== null && amountPaid !== '') {
      totalAmountPaidNum = parseFloat(amountPaid) || 0;
    }
    
    // Calculate total weight of all materials
    let totalWeightAllMaterials = 0;
    materialsArray.forEach(mat => {
      totalWeightAllMaterials += (parseFloat(mat.weight) || 0);
    });

    if (totalWeightAllMaterials <= 0) {
      return res.status(400).json({ success: false, message: "Total weight must be greater than zero" });
    }

    // Handle vehicle image
    const vehicleImage = req.file ? `/uploads/${req.file.filename}` : "";

    const createdPurchases = [];

    // Loop through materials and create records
    for (const mat of materialsArray) {
      const matWeight = parseFloat(mat.weight) || 0;
      const weightRatio = matWeight / totalWeightAllMaterials;
      
      const matPrice = totalPriceNum * weightRatio;
      const matAdvancePayment = totalAdvancePaymentNum * weightRatio;
      const matAmountPaid = totalAmountPaidNum * weightRatio;
      const matTotalPaid = matAdvancePayment + matAmountPaid;

      // Calculate payment status
      let paidAmount = 'none';
      let remainingAmount = matPrice;
      
      if (matTotalPaid === 0) {
        paidAmount = 'none';
        remainingAmount = matPrice;
      } else if (matTotalPaid >= matPrice - 0.01) { // small tolerance for floating point
        paidAmount = 'paid';
        remainingAmount = 0;
      } else {
        paidAmount = 'partial';
        remainingAmount = matPrice - matTotalPaid;
      }

      // Convert qualities array to comma-separated string
      const qualityString = Array.isArray(mat.qualities) ? mat.qualities.join(', ') : mat.qualities;

      // Create purchase
      const purchase = await Purchase.create({
        materialName: mat.materialName,
        vendor,
        price: matPrice.toFixed(2), // Stored as string, similar to before
        weight: mat.weight,
        quality: qualityString,
        purchaseDate,
        purchaseTime,
        materialColor: mat.materialColor,
        vehicleName,
        vehicleType,
        vehicleNumber,
        driverName,
        vehicleColor,
        deliveryDate,
        deliveryTime,
        receiptNo,
        code,
        advancePayment: matAdvancePayment,
        amountPaid: matAmountPaid,
        totalPaid: matTotalPaid,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        vehicleImage,
      });
      
      createdPurchases.push(purchase);
    }

    res.status(201).json({
      success: true,
      message: `Successfully added ${createdPurchases.length} purchases`,
      data: createdPurchases,
    });

  } catch (error) {
    console.error('=== ERROR in addPurchase ===');
    console.error('Error:', error);
    throw error;
  } finally {
    console.log('=== END addPurchase ===');
  }
});
// Get All Purchases (remaining weight = original - sold - productionConsumed, so it shows everywhere in POP)
const getPurchases = asyncHandler(async (req, res) => {
  const purchases = await Purchase.find().sort({ createdAt: -1 }).lean();
  const data = purchases.map((p) => {
    const totalWeight = parseFloat(p.weight) || 0;
    const sold = p.soldWeight || 0;
    const productionConsumed = p.productionConsumedWeight || 0;
    const remainingWeight = Math.max(0, totalWeight - sold - productionConsumed);
    return { ...p, remainingWeight };
  });
  res.status(200).json({ success: true, data });
});

// Get Single Purchase (include computed remaining weight for POP display)
const getPurchaseById = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id).lean();
  if (!purchase)
    return res.status(404).json({ success: false, message: "Not Found" });
  const totalWeight = parseFloat(purchase.weight) || 0;
  const sold = purchase.soldWeight || 0;
  const productionConsumed = purchase.productionConsumedWeight || 0;
  const remainingWeight = Math.max(0, totalWeight - sold - productionConsumed);
  res.status(200).json({ success: true, data: { ...purchase, remainingWeight } });
});

// Update Purchase
const updatePurchase = asyncHandler(async (req, res) => {
  const updatedData = { ...req.body };

  if (req.file) {
    updatedData.vehicleImage = `/uploads/${req.file.filename}`;
  }

  const purchase = await Purchase.findByIdAndUpdate(
    req.params.id,
    updatedData,
    { new: true }
  );

  res.status(200).json({
    success: true,
    message: "Purchase updated successfully",
    data: purchase,
  });
});

// Delete Purchase
const deletePurchase = asyncHandler(async (req, res) => {
  await Purchase.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: "Purchase deleted successfully",
  });
});

// 🔍 Get purchase with remaining weight calculation
const getPurchaseWithRemainingWeight = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Get purchase
  const purchase = await Purchase.findById(id);
  if (!purchase) {
    return res.status(404).json({
      success: false,
      message: "Purchase not found"
    });
  }
  
  // Get all sales for this material
  const sales = await Sale.find({ materialName: purchase.materialName });
  
  // Calculate sold weight
  let soldWeight = 0;
  sales.forEach(sale => {
    soldWeight += parseFloat(sale.weight) || 0;
  });
  
  const totalWeight = parseFloat(purchase.weight) || 0;
  const productionConsumed = purchase.productionConsumedWeight || 0;
  const remainingWeight = Math.max(0, totalWeight - soldWeight - productionConsumed);
  
  const purchaseWithRemaining = {
    ...purchase.toObject(),
    totalWeight,
    soldWeight,
    remainingWeight,
    salesCount: sales.length
  };
  
  res.status(200).json({
    success: true,
    data: purchaseWithRemaining
  });
});

// 📊 Get all purchases with remaining weight (for POP view)
// controllers/pop.controller.js

// Get all purchases with remaining weight
const getAllPurchasesWithRemainingWeight = asyncHandler(async (req, res) => {
  const purchases = await Purchase.find().sort({ createdAt: -1 });
  
  const purchasesWithRemaining = await Promise.all(
    purchases.map(async (purchase) => {
      try {
        // Get all sales for this purchase
        const sales = await Sale.find({ 
          materialName: purchase.materialName 
        });
        
        // Calculate sold weight
        let soldWeight = 0;
        sales.forEach(sale => {
          soldWeight += parseFloat(sale.weight) || 0;
        });
        
        const totalWeight = parseFloat(purchase.weight) || 0;
        const productionConsumed = purchase.productionConsumedWeight || 0;
        const remainingWeight = Math.max(0, totalWeight - soldWeight - productionConsumed);
        
        return {
          ...purchase.toObject(),
          totalWeight,
          soldWeight,
          remainingWeight,
          salesCount: sales.length
        };
      } catch (error) {
        console.error(`Error calculating for ${purchase.materialName}:`, error);
        const totalWeight = parseFloat(purchase.weight) || 0;
        const productionConsumed = purchase.productionConsumedWeight || 0;
        return {
          ...purchase.toObject(),
          totalWeight,
          soldWeight: 0,
          remainingWeight: Math.max(0, totalWeight - productionConsumed),
          salesCount: 0
        };
      }
    })
  );
  
  res.status(200).json({
    success: true,
    data: purchasesWithRemaining
  });
});

// 📈 Get purchase statistics
const getPurchaseStatistics = asyncHandler(async (req, res) => {
  const totalPurchases = await Purchase.countDocuments();
  const totalWeight = await Purchase.aggregate([
    {
      $group: {
        _id: null,
        totalWeight: { 
          $sum: { 
            $convert: { input: "$weight", to: "double", onError: 0 } 
          }
        }
      }
    }
  ]);
  
  const totalValue = await Purchase.aggregate([
    {
      $group: {
        _id: null,
        totalValue: { 
          $sum: { 
            $convert: { input: "$price", to: "double", onError: 0 } 
          }
        }
      }
    }
  ]);
  
  const totalAdvancePayment = await Purchase.aggregate([
    {
      $group: {
        _id: null,
        totalAdvance: { $sum: "$advancePayment" }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalPurchases,
      totalWeight: totalWeight[0]?.totalWeight || 0,
      totalValue: totalValue[0]?.totalValue || 0,
      totalAdvancePayment: totalAdvancePayment[0]?.totalAdvance || 0,
    }
  });
});

module.exports = {
  addPurchase,
  getPurchases,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
  getPurchaseWithRemainingWeight,
  getAllPurchasesWithRemainingWeight,
  getPurchaseStatistics,
};