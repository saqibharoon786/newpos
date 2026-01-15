const Purchase = require("../models/pop.model");
const Sale = require("../models/pos.model");

// Add Purchase
const addPurchase = async (req, res) => {
  try {
    console.log('=== START addPurchase ===');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
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
    } = req.body;

    console.log('Parsed values:');
    console.log('materialColor:', materialColor);
    console.log('vehicleColor:', vehicleColor);
    console.log('advancePayment:', advancePayment);

    // Validate required fields
    if (!materialName || !vendor || !price || !weight || !purchaseDate) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing: materialName, vendor, price, weight, purchaseDate"
      });
    }

    // Handle vehicle image
    const vehicleImage = req.file ? `/uploads/${req.file.filename}` : "";

    console.log('Creating purchase with:', {
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
      vehicleImage
    });

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
      advancePayment: advancePayment || 0,
      vehicleImage,
    });

    console.log('Purchase created successfully:', purchase._id);

    res.status(201).json({
      success: true,
      message: "Purchase added successfully",
      data: purchase,
    });

  } catch (error) {
    console.error('=== ERROR in addPurchase ===');
    console.error('Error message:', error.message);
    
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

// Get All Purchases
const getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Purchase
const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase)
      return res.status(404).json({ success: false, message: "Not Found" });

    res.status(200).json({ success: true, data: purchase });
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
    const remainingWeight = totalWeight - soldWeight;
    
    const purchaseWithRemaining = {
      ...purchase.toObject(),
      totalWeight,
      soldWeight,
      remainingWeight: remainingWeight > 0 ? remainingWeight : 0,
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
          const remainingWeight = totalWeight - soldWeight;
          
          return {
            ...purchase.toObject(),
            totalWeight,
            soldWeight,
            remainingWeight: remainingWeight > 0 ? remainingWeight : 0,
            salesCount: sales.length
          };
        } catch (error) {
          console.error(`Error calculating for ${purchase.materialName}:`, error);
          const totalWeight = parseFloat(purchase.weight) || 0;
          return {
            ...purchase.toObject(),
            totalWeight,
            soldWeight: 0,
            remainingWeight: totalWeight,
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