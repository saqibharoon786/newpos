const { default: mongoose } = require("mongoose");
const Sale = require("../models/pos.model");
const path = require("path");
const fs = require("fs");

// ➕ Add Sale (with optional receipt image) - FIXED VERSION
const addSale = async (req, res) => {
  try {
    console.log("=== ADD SALE REQUEST ===");
    console.log("Request file:", req.file); // Debug log
    console.log("Request body:", req.body); // Debug log
    console.log("Request body keys:", Object.keys(req.body)); // Debug log
    
    const {
      materialName,
      supplierName,
      invoiceNo,
      weight,
      unit,
      purchaseDate,
      purchaseTime,
      branch,
      materialColor,
      actualPrice,
      productionCost,
      sellingPrice,
      discount,
      buyerName,
      buyerAddress,
      buyerPhone,
      buyerEmail,
      buyerCnic,
      buyerCompany,
    } = req.body;

    console.log("Invoice No from body:", invoiceNo); // Debug log

    const finalAmount =
      (parseFloat(sellingPrice) || 0) - (parseFloat(discount) || 0);

    // Handle receipt image uploaded via Multer
    let receiptImagePath = "";
    
    if (req.file) {
      // File is saved by Multer - get the filename
      console.log("File received:", req.file); // Debug log
      console.log("File name:", req.file.filename); // Debug log
      console.log("File path:", req.file.path); // Debug log
      
      // Store path relative to uploads folder
      receiptImagePath = `/receipts/${req.file.filename}`;
      console.log("Receipt image path to save:", receiptImagePath); // Debug log
    } else {
      console.log("No file received in request"); // Debug log
    }

    const sale = await Sale.create({
      materialName,
      supplierName,
      invoiceNo,
      weight,
      unit,
      purchaseDate,
      purchaseTime,
      branch,
      materialColor,
      actualPrice,
      productionCost,
      sellingPrice,
      discount,
      finalAmount,
      buyerName,
      buyerAddress,
      buyerPhone,
      buyerEmail,
      buyerCnic,
      buyerCompany,
      receiptImage: receiptImagePath, // Save the path
    });

    console.log("Sale created successfully. ID:", sale._id); // Debug log
    console.log("Receipt image in saved sale:", sale.receiptImage); // Debug log

    res.status(201).json({
      success: true,
      message: "Sale added successfully",
      data: sale,
    });
  } catch (error) {
    console.error('Error in addSale:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      stack: error.stack // Add stack trace for debugging
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
      saleObj.receiptImage = `${req.protocol}://${req.get('host')}/uploads/${saleObj.receiptImage}`;
    }

    res.status(200).json({ success: true, data: saleObj });

  } catch (error) {
    console.error('Error in getSaleById:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✏️ Update Sale (with receipt image update)
const updateSale = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("=== UPDATE SALE REQUEST ===");
    console.log("Request file:", req.file); // Debug log
    console.log("Request body:", req.body); // Debug log

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

    // Handle receipt image via Multer
    if (req.file) {
      console.log("New file uploaded:", req.file.filename); // Debug log
      
      // Delete old receipt image if exists
      if (existingSale.receiptImage && existingSale.receiptImage.trim() !== '') {
        const oldImagePath = path.join(process.env.UPLOAD_PATH || "./uploads", existingSale.receiptImage);
        console.log("Old image path:", oldImagePath); // Debug log
        
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log("Old image deleted"); // Debug log
        }
      }
      
      // Save new receipt image path
      updateData.receiptImage = `/receipts/${req.file.filename}`;
      console.log("New receipt image path:", updateData.receiptImage); // Debug log
    } else if (req.body.removeReceipt === 'true') {
      // If user wants to remove receipt image
      if (existingSale.receiptImage && existingSale.receiptImage.trim() !== '') {
        const oldImagePath = path.join(process.env.UPLOAD_PATH || "./uploads", existingSale.receiptImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updateData.receiptImage = "";
    }

    // Calculate final amount if sellingPrice or discount is updated
    if (updateData.sellingPrice || updateData.discount) {
      updateData.finalAmount =
        (parseFloat(updateData.sellingPrice) || parseFloat(existingSale.sellingPrice) || 0) -
        (parseFloat(updateData.discount) || parseFloat(existingSale.discount) || 0);
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

// 🗑 Delete Sale (with receipt image cleanup)
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

module.exports = {
  addSale,
  getSales,
  getSaleById,
  updateSale,
  deleteSale,
};