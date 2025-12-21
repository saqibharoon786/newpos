const Asset = require('../models/assets.model');

// @desc    Create a new asset
// @route   POST /api/assets
// @access  Private
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

    // Parse date and time if provided
    let purchaseDate = new Date();
    if (date) {
      purchaseDate = new Date(date);
    }

    // Create asset object
    const assetData = {
      assetName,
      category,
      quantity: parseInt(quantity),
      sizeModel,
      condition,
      description,
      department,
      assignedTo,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice.replace(/,/g, '')) : undefined,
      purchaseFrom,
      invoiceNo,
      purchaseDate,
      purchaseTime: time
    };

    // Set createdBy from authenticated user
    if (req.user) {
      assetData.createdBy = req.user.id;
    }

    const asset = await Asset.create(assetData);

    res.status(201).json({
      success: true,
      data: asset,
      message: 'Asset created successfully'
    });
  } catch (error) {
    console.error('Error creating asset:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Get all assets
// @route   GET /api/assets
// @access  Private
exports.getAllAssets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      department,
      condition,
      status,
      search
    } = req.query;

    // Build query
    const query = {};

    if (category) query.category = category;
    if (department) query.department = department;
    if (condition) query.condition = condition;
    if (status) query.status = status;

    // Search functionality
    if (search) {
      query.$or = [
        { assetName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { invoiceNo: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const assets = await Asset.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const total = await Asset.countDocuments(query);

    res.status(200).json({
      success: true,
      count: assets.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
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

// @desc    Get single asset by ID
// @route   GET /api/assets/:id
// @access  Private
exports.getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id).populate('createdBy', 'name email');

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
      time,
      status
    } = req.body;

    let asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    // Prepare update data
    const updateData = {
      assetName,
      category,
      quantity: quantity ? parseInt(quantity) : asset.quantity,
      sizeModel,
      condition,
      description,
      department,
      assignedTo,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice.replace(/,/g, '')) : asset.purchasePrice,
      purchaseFrom,
      invoiceNo,
      status
    };

    // Update date if provided
    if (date) {
      updateData.purchaseDate = new Date(date);
    }
    if (time) {
      updateData.purchaseTime = time;
    }

    asset = await Asset.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      data: asset,
      message: 'Asset updated successfully'
    });
  } catch (error) {
    console.error('Error updating asset:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error'
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
          totalValue: { $sum: { $ifNull: ['$purchasePrice', 0] } },
          avgValue: { $avg: '$purchasePrice' }
        }
      },
      {
        $project: {
          _id: 0,
          totalAssets: 1,
          totalValue: 1,
          avgValue: { $round: ['$avgValue', 2] }
        }
      }
    ]);

    const categoryStats = await Asset.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: { $ifNull: ['$purchasePrice', 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const conditionStats = await Asset.aggregate([
      {
        $group: {
          _id: '$condition',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const departmentStats = await Asset.aggregate([
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || { totalAssets: 0, totalValue: 0, avgValue: 0 },
        byCategory: categoryStats,
        byCondition: conditionStats,
        byDepartment: departmentStats
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