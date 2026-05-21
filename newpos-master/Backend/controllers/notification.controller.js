const Notification = require('../models/notification.model');

exports.getNotifications = async (req, res) => {
  try {
    const { role, userId, unreadOnly } = req.query;
    const query = { $or: [{ targetRoles: role }, { targetUserId: userId }, { targetRoles: { $size: 0 } }] };
    if (unreadOnly === 'true') query.isRead = false;
    const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createNotification = async (data) => {
  try {
    return await Notification.create(data);
  } catch (err) {
    console.error('Notification create error:', err.message);
    return null;
  }
};
