const { USER_ROLES } = require('./constants');

const PERMISSIONS = {
  [USER_ROLES.ACCOUNTANT1]: ['create', 'view', 'edit_own_draft'],
  [USER_ROLES.ACCOUNTANT2]: ['create', 'view', 'edit_own_draft'],
  [USER_ROLES.OWNER]: ['*'],
  [USER_ROLES.ADMIN]: ['*'],
};

function hasPermission(role, permission) {
  const perms = PERMISSIONS[role] || [];
  return perms.includes('*') || perms.includes(permission);
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied for your role' });
    }
    next();
  };
}

function requireOwner(req, res, next) {
  const ownerRoles = [USER_ROLES.OWNER, USER_ROLES.ADMIN];
  if (!req.user || !ownerRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Only Owner can perform this action',
    });
  }
  next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }
    next();
  };
}

module.exports = { hasPermission, authorizeRoles, requireOwner, requirePermission, PERMISSIONS };
