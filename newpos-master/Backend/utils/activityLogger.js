const ActivityLog = require('../models/activityLog.model');

async function logActivity({
  userId = 'system',
  userName = 'System',
  action,
  module,
  recordId,
  beforeValues,
  afterValues,
  reason = '',
  req,
}) {
  try {
    await ActivityLog.create({
      userId,
      userName,
      action,
      module,
      recordId: recordId ? String(recordId) : undefined,
      beforeValues,
      afterValues,
      reason,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'],
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

module.exports = { logActivity };
