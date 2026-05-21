const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    action: {
      type: String,
      enum: ['Create', 'Edit', 'Delete', 'Approve', 'Reject', 'Login', 'Logout'],
      required: true,
    },
    module: { type: String, required: true },
    recordId: { type: String },
    beforeValues: { type: mongoose.Schema.Types.Mixed },
    afterValues: { type: mongoose.Schema.Types.Mixed },
    reason: { type: String, default: '' },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ module: 1, recordId: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
