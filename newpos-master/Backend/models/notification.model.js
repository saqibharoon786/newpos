const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['pending_approval', 'low_stock', 'outstanding_balance', 'system'],
      default: 'system',
    },
    targetRoles: [{ type: String }],
    targetUserId: { type: String },
    module: { type: String },
    recordId: { type: String },
    isRead: { type: Boolean, default: false },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
