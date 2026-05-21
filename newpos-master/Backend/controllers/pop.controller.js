const Purchase = require("../models/pop.model");
const Sale = require("../models/pos.model");
const { computePurchasePayment, withComputedPayment } = require("../utils/purchasePayment");

// Add Purchase
const addPurchase = async (req, res) => {
  try {
    console.log('=== START addPurchase ===');
    console.log('Request body:', req.body);
    
    const {
      materialName,
      vendor,
      price,
      weight,
      quality,
      purchaseDate,
      materialColor,
      vehicleName,
      vehicleType,
      vehicleNumber,
      driverName,
      vehicleColor,
      deliveryDate,
      receiptNo,
      advancePayment,
      amountPaid,
    } = req.body;

    console.log('Payment details from request:');
    console.log('advancePayment:', advancePayment);
    console.log('amountPaid:', amountPaid);

    // Validate required fields
    if (!materialName || !vendor || !price || !weight || !purchaseDate) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing: materialName, vendor, price, weight, purchaseDate"
      });
    }

    // Convert price to number
    const priceNum = parseFloat(price) || 0;
    
    let advancePaymentNum = 0;
    if (advancePayment !== undefined && advancePayment !== null && advancePayment !== "") {
      advancePaymentNum = parseFloat(advancePayment) || 0;
    }

    let amountPaidNum = 0;
    if (amountPaid !== undefined && amountPaid !== null && amountPaid !== "") {
      amountPaidNum = parseFloat(amountPaid) || 0;
    }

    const payment = computePurchasePayment({
      price: priceNum,
      advancePayment: advancePaymentNum,
      amountPaid: amountPaidNum,
    });

    console.log("Payment calculations:");
    console.log("Total Price:", priceNum);
    console.log("Advance Payment:", advancePaymentNum);
    console.log("Amount Paid (at purchase):", amountPaidNum);
    console.log("Total Paid:", payment.totalPaid);
    console.log("Payment Status:", payment.paidAmount);
    console.log("Remaining Amount:", payment.remainingAmount);

    // Handle vehicle image
    const vehicleImage = req.file ? `/uploads/${req.file.filename}` : "";

    // Create purchase
    const purchase = await Purchase.create({
      materialName,
      vendor,
      price,
      weight,
      quality,
      purchaseDate,
      materialColor,
      vehicleName,
      vehicleType,
      vehicleNumber,
      driverName,
      vehicleColor,
      deliveryDate,
      receiptNo,
      advancePayment: advancePaymentNum,
      amountPaid: amountPaidNum,
      totalPaid: payment.totalPaid,
      paidAmount: payment.paidAmount,
      remainingAmount: payment.remainingAmount,
      vehicleImage,
    });

    console.log('Purchase created with payment summary:');
    console.log('- Advance Payment:', purchase.advancePayment);
    console.log('- Amount Paid:', purchase.amountPaid);
    console.log('- Total Paid:', purchase.totalPaid);
    console.log('- Payment Status:', purchase.paidAmount);
    console.log('- Remaining Amount:', purchase.remainingAmount);

    res.status(201).json({
      success: true,
      message: "Purchase added successfully",
      data: purchase,
    });

  } catch (error) {
    console.error('=== ERROR in addPurchase ===');
    console.error('Error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: messages
      });
    }
    
    // Handle cast errors
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: `Invalid data format for field: ${error.path}`,
        error: error.message
      });
    }

    res.status(500).json({ 
      success: false, 
      message: error.message || "Internal server error"
    });
  } finally {
    console.log('=== END addPurchase ===');
  }
};
// Get All Purchases (remaining weight = original - sold - productionConsumed, so it shows everywhere in POP)
const getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find().sort({ createdAt: -1 }).lean();
    const data = purchases.map((p) => {
      const totalWeight = parseFloat(p.weight) || 0;
      const sold = p.soldWeight || 0;
      const productionConsumed = p.productionConsumedWeight || 0;
      const remainingWeight = Math.max(0, totalWeight - sold - productionConsumed);
      return withComputedPayment({ ...p, remainingWeight });
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Purchase (include computed remaining weight for POP display)
const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id).lean();
    if (!purchase)
      return res.status(404).json({ success: false, message: "Not Found" });
    const totalWeight = parseFloat(purchase.weight) || 0;
    const sold = purchase.soldWeight || 0;
    const productionConsumed = purchase.productionConsumedWeight || 0;
    const remainingWeight = Math.max(0, totalWeight - sold - productionConsumed);
    res.status(200).json({
      success: true,
      data: withComputedPayment({ ...purchase, remainingWeight }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Purchase
const updatePurchase = async (req, res) => {
  try {
    const updatedData = { ...req.body };

    if (req.file) {
      updatedData.vehicleImage = `/uploads/${req.file.filename}`;
    }

    const existing = await Purchase.findById(req.params.id).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: "Not Found" });
    }

    const merged = { ...existing, ...updatedData };
    const payment = computePurchasePayment(merged);
    updatedData.totalPaid = payment.totalPaid;
    updatedData.paidAmount = payment.paidAmount;
    updatedData.remainingAmount = payment.remainingAmount;

    const purchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      updatedData,
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Purchase updated successfully",
      data: withComputedPayment(purchase.toObject()),
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Purchase
const deletePurchase = async (req, res) => {
  try {
    await Purchase.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Purchase deleted successfully",
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🔍 Get purchase with remaining weight calculation
const getPurchaseWithRemainingWeight = async (req, res) => {
  try {
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
    
  } catch (error) {
    console.error('Error in getPurchaseWithRemainingWeight:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 📊 Get all purchases with remaining weight (for POP view)
// controllers/pop.controller.js

// Get all purchases with remaining weight
const getAllPurchasesWithRemainingWeight = async (req, res) => {
  try {
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
          
          return withComputedPayment({
            ...purchase.toObject(),
            totalWeight,
            soldWeight,
            remainingWeight,
            salesCount: sales.length
          });
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
    
  } catch (error) {
    console.error('Error in getAllPurchasesWithRemainingWeight:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 📈 Get purchase statistics
const getPurchaseStatistics = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error in getPurchaseStatistics:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

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