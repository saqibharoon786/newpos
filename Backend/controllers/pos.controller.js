const mongoose = require("mongoose");
const Sale = require("../models/pos.model");
const Purchase = require("../models/pop.model");
const path = require("path");
const fs = require("fs");

// ➕ Add Sale (with optional receipt image)
// controllers/pos.controller.js

// Add Sale function - UPDATED VERSION
const addSale = async (req, res) => {
  try {
    const {
      purchaseId,
      customerName,
      customerPhone,
      customerEmail,
      sellingPrice,
      sellingWeight,
      saleDate,
      paymentMethod,
      paymentStatus,
      invoiceNo,
      transportationCost,
      notes
    } = req.body;

    // Validate required fields
    if (!purchaseId || !customerName || !sellingPrice || !sellingWeight || !invoiceNo) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing: purchaseId, customerName, sellingPrice, sellingWeight, invoiceNo"
      });
    }

    // Find purchase
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found"
      });
    }

    // Convert weights to numbers
    const purchaseWeight = parseFloat(purchase.weight) || 0;
    const weightToSell = parseFloat(sellingWeight);

    // Check if enough stock
    if (weightToSell > purchaseWeight) {
      return res.status(400).json({
        success: false,
        message: `Cannot sell ${weightToSell}kg. Only ${purchaseWeight}kg available.`
      });
    }

    // Calculate new remaining weight
    const newRemainingWeight = purchaseWeight - weightToSell;

    // Update purchase record
    purchase.weight = newRemainingWeight.toString();
    
    // Update status if all sold
    if (newRemainingWeight === 0) {
      purchase.status = 'sold_out';
    } else {
      purchase.status = 'partially_sold';
    }
    
    await purchase.save();

    // Get receipt image if uploaded
    const receiptImage = req.file ? `/uploads/receipts/${req.file.filename}` : "";

    // Create sale record using your Sale model fields
    // Map frontend fields to Sale model fields
    const sale = await Sale.create({
      // Map from frontend to Sale model
      purchaseId,  // Add this to your Sale model if not exists
      materialName: purchase.materialName,  // Get from purchase
      supplierName: purchase.vendor,        // Get from purchase
      invoiceNo,
      weight: sellingWeight.toString(),     // Selling weight
      unit: "kg",                           // Default or get from purchase
      purchaseDate: saleDate || new Date().toISOString(),
      purchaseTime: new Date().toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      }),
      branch: "Main",                       // Default
      materialColor: purchase.materialColor, // Get from purchase
      actualPrice: purchase.price,          // Get from purchase
      productionCost: "0",                   // Default or calculate
      sellingPrice: sellingPrice.toString(),
      discount: "0",
      finalAmount: sellingPrice.toString(),
      advancePayment: 0,
      buyerName: customerName,
      buyerAddress: "",
      buyerPhone: customerPhone || "",
      buyerEmail: customerEmail || "",
      buyerCnic: "",
      buyerCompany: "",
      receiptImage,
      transportationCost: transportationCost || 0,
      notes: notes || ""
    });

    res.status(201).json({
      success: true,
      message: "Sale completed successfully",
      data: {
        sale,
        updatedPurchase: {
          id: purchase._id,
          remainingWeight: newRemainingWeight,
          status: purchase.status
        }
      }
    });

  } catch (error) {
    console.error('Sale error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};

// 📥 Get All Sales
const getSales = async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    
    // Add full URL to receiptImage if it exists
    const salesWithFullUrls = sales.map(sale => {
      const saleObj = sale.toObject();
      if (saleObj.receiptImage && saleObj.receiptImage.trim() !== '') {
        saleObj.receiptImage = `${req.protocol}://${req.get('host')}${saleObj.receiptImage}`;
      }
      return saleObj;
    });
    
    res.status(200).json({ success: true, data: salesWithFullUrls });
  } catch (error) {
    console.error('Error in getSales:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📄 Get Sale by ID
const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sale ID",
      });
    }

    const sale = await Sale.findById(id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Add full URL to receiptImage if it exists
    const saleObj = sale.toObject();
    if (saleObj.receiptImage && saleObj.receiptImage.trim() !== '') {
      saleObj.receiptImage = `${req.protocol}://${req.get('host')}${saleObj.receiptImage}`;
    }

    res.status(200).json({ success: true, data: saleObj });

  } catch (error) {
    console.error('Error in getSaleById:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✏️ Update Sale
const updateSale = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("=== UPDATE SALE REQUEST ===");
    console.log("Request file:", req.file);
    console.log("Request body:", req.body);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sale ID",
      });
    }

    // Check if sale exists
    const existingSale = await Sale.findById(id);
    if (!existingSale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Prepare update data
    const updateData = { ...req.body };

    // Handle receipt image
    if (req.file) {
      console.log("New file uploaded:", req.file.filename);
      
      // Delete old receipt image if exists
      if (existingSale.receiptImage && existingSale.receiptImage.trim() !== '') {
        const oldImagePath = path.join(process.env.UPLOAD_PATH || "./uploads", existingSale.receiptImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      // Save new receipt image path
      updateData.receiptImage = `/receipts/${req.file.filename}`;
    } else if (req.body.removeReceipt === 'true') {
      // Remove receipt image
      if (existingSale.receiptImage && existingSale.receiptImage.trim() !== '') {
        const oldImagePath = path.join(process.env.UPLOAD_PATH || "./uploads", existingSale.receiptImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updateData.receiptImage = "";
    }

    // Calculate final amount
    if (updateData.sellingPrice || updateData.discount) {
      const sellingPriceNum = parseFloat(updateData.sellingPrice) || parseFloat(existingSale.sellingPrice) || 0;
      const discountNum = parseFloat(updateData.discount) || parseFloat(existingSale.discount) || 0;
      updateData.finalAmount = (sellingPriceNum - discountNum).toString();
    }

    // Handle advance payment
    if (updateData.advancePayment !== undefined) {
      updateData.advancePayment = parseFloat(updateData.advancePayment) || 0;
    }

    const sale = await Sale.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    // Add full URL to receiptImage for response
    const saleObj = sale.toObject();
    if (saleObj.receiptImage && saleObj.receiptImage.trim() !== '') {
      saleObj.receiptImage = `${req.protocol}://${req.get('host')}${saleObj.receiptImage}`;
    }

    res.status(200).json({
      success: true,
      message: "Sale updated successfully",
      data: saleObj,
    });
  } catch (error) {
    console.error('Error in updateSale:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🗑 Delete Sale
const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Sale ID",
      });
    }

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Delete receipt image if exists
    if (sale.receiptImage && sale.receiptImage.trim() !== '') {
      const imagePath = path.join(process.env.UPLOAD_PATH || "./uploads", sale.receiptImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Sale.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "Sale deleted successfully",
    });
  } catch (error) {
    console.error('Error in deleteSale:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🔍 Get all sales by material name (for POP integration)
const getSalesByMaterial = async (req, res) => {
  try {
    const { materialName } = req.params;
    
    const sales = await Sale.find({ materialName }).sort({ createdAt: -1 });
    
    // Calculate total sold weight
    let totalSoldWeight = 0;
    sales.forEach(sale => {
      totalSoldWeight += parseFloat(sale.weight) || 0;
    });
    
    // Add full URL to receiptImage if it exists
    const salesWithFullUrls = sales.map(sale => {
      const saleObj = sale.toObject();
      if (saleObj.receiptImage && saleObj.receiptImage.trim() !== '') {
        saleObj.receiptImage = `${req.protocol}://${req.get('host')}${saleObj.receiptImage}`;
      }
      return saleObj;
    });
    
    res.status(200).json({ 
      success: true, 
      data: salesWithFullUrls,
      totalSoldWeight,
      salesCount: sales.length
    });
  } catch (error) {
    console.error('Error in getSalesByMaterial:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 📊 Get total sold weight by material
const getTotalSoldWeightByMaterial = async (req, res) => {
  try {
    const { materialName } = req.params;
    
    const sales = await Sale.find({ materialName });
    
    let totalSoldWeight = 0;
    sales.forEach(sale => {
      totalSoldWeight += parseFloat(sale.weight) || 0;
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalSoldWeight,
        salesCount: sales.length
      }
    });
  } catch (error) {
    console.error('Error in getTotalSoldWeightByMaterial:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 📈 Get sales statistics
const getSalesStatistics = async (req, res) => {
  try {
    const totalSales = await Sale.countDocuments();
    const totalWeight = await Sale.aggregate([
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
    
    const totalAdvancePayment = await Sale.aggregate([
      {
        $group: {
          _id: null,
          totalAdvance: { $sum: "$advancePayment" }
        }
      }
    ]);
    
    const totalRevenue = await Sale.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { 
            $sum: { 
              $convert: { input: "$finalAmount", to: "double", onError: 0 } 
            }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalSales,
        totalWeight: totalWeight[0]?.totalWeight || 0,
        totalAdvancePayment: totalAdvancePayment[0]?.totalAdvance || 0,
        totalRevenue: totalRevenue[0]?.totalRevenue || 0,
      }
    });
  } catch (error) {
    console.error('Error in getSalesStatistics:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

module.exports = {
  addSale,
  getSales,
  getSaleById,
  updateSale,
  deleteSale,
  getSalesByMaterial,
  getTotalSoldWeightByMaterial,
  getSalesStatistics,
};