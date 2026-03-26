const { verifyAccessToken, canAccess } = require('../services/auth');
const { getUserById } = require('../db/repositories');

/**
 * Extract bearer token from Authorization header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getBearerToken(req) {
  const header = req.get('authorization') || req.get('Authorization');
  if (!header) return null;
  const parts = String(header).split(' ');
  if (parts.length !== 2) return null;
  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token || null;
}

// PUBLIC_INTERFACE
function requireAuth() {
  /** Express middleware: require a valid JWT and attach req.user. */
  return async (req, res, next) => {
    try {
      const token = getBearerToken(req);
      if (!token) {
        return res.status(401).json({ status: 'error', message: 'Missing bearer token' });
      }

      const payload = verifyAccessToken(token);

      // Optionally re-check user active status from DB (supports deactivation).
      const user = await getUserById(payload.sub);
      if (!user || user.is_active === false) {
        return res.status(401).json({ status: 'error', message: 'Invalid user' });
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      return next();
    } catch (e) {
      return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
    }
  };
}

// PUBLIC_INTERFACE
function requireRole(minRole) {
  /** Express middleware: require req.user.role to meet a minimum role. */
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Not authenticated' });
    }

    if (!canAccess(minRole, user.role)) {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
