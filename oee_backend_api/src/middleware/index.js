const { requireAuth, requireRole } = require('./auth');

// This file exports middleware as the application grows
module.exports = {
  requireAuth,
  requireRole,
};
