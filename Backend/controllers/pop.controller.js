const Purchase = require("../models/pop.model");

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
    } = req.body;

    console.log('Parsed values:');
    console.log('materialColor:', materialColor, 'Type:', typeof materialColor);
    console.log('vehicleColor:', vehicleColor, 'Type:', typeof vehicleColor);

    // Ensure we have required fields
    if (!materialName || !vendor || !price || !weight || !purchaseDate) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing: materialName, vendor, price, weight, purchaseDate"
      });
    }

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
      vehicleImage
    });

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
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);
    
    // Check for Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: messages
      });
    }
    
    // Check for Mongoose CastError
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

// Get All
const getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single
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

// Update
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

// Delete
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

module.exports = {
  addPurchase,
  getPurchases,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
};
