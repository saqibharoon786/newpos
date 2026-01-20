const multer = require('multer');
const Asset = require('../models/assets.model');

// @desc    Create a new asset
// @route   POST /api/assets
// @access  Private
// In your assets.controller.js, update the createAsset function:



exports.createAsset = async (req, res) => {
  try {
    const {
      assetName,
      category,
      quantity,
      sizeModel,
      condition,
      description,
      department,
      assignedTo,
      purchasePrice,
      purchaseFrom,
      invoiceNo,
      date,
      time
    } = req.body;

    console.log('📥 Received asset data:', req.body);
    // console.log('📥 File received from Multer:', a);
    console.log('📥 Files received:', req.files);

    // Basic validation
    if (!assetName || !category || !condition || !department) {
      return res.status(400).json({
        success: false,
        error: 'Required fields: assetName, category, condition, department'
      });
    }

    // Parse date and time
    let purchaseDate = new Date();
    if (date) {
      if (typeof date === 'string' && date.includes('/')) {
        const [day, month, year] = date.split('/').map(Number);
        purchaseDate = new Date(year, month - 1, day);
      } else {
        purchaseDate = new Date(date);
      }
    }

    // Parse purchasePrice properly
    let parsedPurchasePrice = null;
    if (purchasePrice && purchasePrice !== "" && purchasePrice !== null) {
      try {
        const cleanPrice = String(purchasePrice).replace(/,/g, '').trim();
        if (cleanPrice && !isNaN(cleanPrice)) {
          parsedPurchasePrice = parseFloat(cleanPrice);
        }
      } catch (e) {
        console.log('Warning: Could not parse purchasePrice:', purchasePrice);
      }
    }

    // IMPORTANT: Receipt image ka FULL PATH save karo
    let receiptImagePath = null;
    if (req.file) {
      // Yeh path frontend ke liye perfect hai
      // Agar tumne app.js mein app.use('/uploads', express.static('uploads')) kiya hai
      receiptImagePath = `/uploads/general/${req.file.filename}`;
      
      // Optional: Agar full URL chahiye (production ke liye better)
      // receiptImagePath = `${req.protocol}://${req.get('host')}/uploads/receipts/${req.file.filename}`;
    }

    const assetData = {
      assetName: String(assetName).trim(),
      category: String(category).trim(),
      quantity: parseInt(quantity) || 1,
      sizeModel: sizeModel ? String(sizeModel).trim() : null,
      condition: String(condition).trim(),
      description: description ? String(description).trim() : null,
      department: String(department).trim(),
      assignedTo: assignedTo ? String(assignedTo).trim() : null,
      purchasePrice: parsedPurchasePrice,
      purchaseFrom: purchaseFrom ? String(purchaseFrom).trim() : null,
      invoiceNo: invoiceNo ? String(invoiceNo).trim() : null,
      purchaseDate,
      purchaseTime: time || null,
      receiptImage: receiptImagePath,   // ← Yeh line fix ki hai
      status: 'Active'
    };

    if (req.user) {
      assetData.createdBy = req.user.id;
    }

    console.log('📤 Creating asset with data:', {
      ...assetData,
      fileInfo: req.file ? {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        path: req.file.path,
        savedUrl: receiptImagePath
      } : 'No file uploaded'
    });

    const asset = await Asset.create(assetData);

    res.status(201).json({
      success: true,
      data: asset,
      message: 'Asset created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating asset:', error);

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB' });
      }
      return res.status(400).json({ success: false, error: `File upload error: ${error.message}` });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ success: false, error: messages.join(', ') });
    }

    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
};
// @desc    Get all assets
// @route   GET /api/assets
// @access  Private
exports.getAllAssets = async (req, res) => {
  try {
    const assets = await Asset.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: assets.length,
      data: assets
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// SIMPLIFIED VERSION - Remove all complex features for now
// @desc    Get all assets simple
// @route   GET /api/assets/get-all
// @access  Private
exports.getAllAssetsSimple = async (req, res) => {
  try {
    const assets = await Asset.find()
      .select('-__v')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: assets
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get single asset by ID
// @route   GET /api/assets/:id
// @access  Private
exports.getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    res.status(200).json({
      success: true,
      data: asset
    });
  } catch (error) {
    console.error('Error fetching asset:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update asset
// @route   PUT /api/assets/:id
// @access  Private
exports.updateAsset = async (req, res) => {
  try {
    console.log('📥 Update request for ID:', req.params.id);
    console.log('📥 Update data:', req.body);

    let asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    // Prepare update data
    const updateData = { ...req.body };

    // Handle purchasePrice conversion if present
    if (updateData.purchasePrice !== undefined) {
      if (updateData.purchasePrice && updateData.purchasePrice !== "" && updateData.purchasePrice !== null) {
        try {
          const cleanPrice = String(updateData.purchasePrice).replace(/,/g, '').trim();
          if (cleanPrice && !isNaN(cleanPrice)) {
            updateData.purchasePrice = parseFloat(cleanPrice);
          } else {
            updateData.purchasePrice = null;
          }
        } catch (e) {
          updateData.purchasePrice = null;
        }
      } else {
        updateData.purchasePrice = null;
      }
    }

    // Handle quantity conversion
    if (updateData.quantity !== undefined) {
      updateData.quantity = parseInt(updateData.quantity) || 1;
    }

    // Handle receiptImage (ensure it's properly set or removed)
    if (updateData.receiptImage !== undefined) {
      updateData.receiptImage = updateData.receiptImage || null;
    }

    console.log('📤 Final update data:', updateData);

    asset = await Asset.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: asset,
      message: 'Asset updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating asset:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Delete asset
// @route   DELETE /api/assets/:id
// @access  Private
exports.deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    await asset.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Asset deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting asset:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get asset statistics
// @route   GET /api/assets/stats
// @access  Private
exports.getAssetStats = async (req, res) => {
  try {
    const stats = await Asset.aggregate([
      {
        $group: {
          _id: null,
          totalAssets: { $sum: 1 },
          totalValue: { $sum: { $ifNull: ['$purchasePrice', 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          totalAssets: 1,
          totalValue: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || { totalAssets: 0, totalValue: 0 }
      }
    });
  } catch (error) {
    console.error('Error fetching asset stats:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};