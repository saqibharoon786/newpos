const ActivityLog = require('../models/activityLog.model');

exports.getActivityLogs = async (req, res) => {
  try {
    const { module, userId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const query = {};
    if (module) query.module = module;
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [logs, total] = await Promise.all([
      ActivityLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).lean(),
      ActivityLog.countDocuments(query),
    ]);
    res.json({ success: true, data: logs, total, page: parseInt(page, 10), pages: Math.ceil(total / parseInt(limit, 10)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
