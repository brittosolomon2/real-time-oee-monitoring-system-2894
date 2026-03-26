const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * Allowed roles in the system.
 * @type {Array<'operator'|'supervisor'|'manager'>}
 */
const ALLOWED_ROLES = ['operator', 'supervisor', 'manager'];

/**
 * @returns {string}
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).trim().length < 16) {
    throw new Error(
      'JWT_SECRET is not set (or is too short). Please set JWT_SECRET to a strong random string (>= 16 chars).'
    );
  }
  return String(secret);
}

/**
 * @returns {string}
 */
function getJwtIssuer() {
  return String(process.env.JWT_ISSUER || 'oee-backend');
}

/**
 * @returns {string}
 */
function getJwtAudience() {
  return String(process.env.JWT_AUDIENCE || 'oee-frontend');
}

/**
 * @returns {number}
 */
function getJwtExpiresInSeconds() {
  const raw = process.env.JWT_EXPIRES_IN_SECONDS || '28800'; // 8h default
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 28800;
  return parsed;
}

// PUBLIC_INTERFACE
function normalizeRole(role) {
  /** Normalize and validate role. */
  const r = String(role || '').trim().toLowerCase();
  if (!ALLOWED_ROLES.includes(r)) return null;
  return r;
}

// PUBLIC_INTERFACE
async function hashPassword(password) {
  /** Hash a plaintext password using bcrypt. */
  const p = String(password || '');
  if (p.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }
  return bcrypt.hash(p, 12);
}

// PUBLIC_INTERFACE
async function verifyPassword(password, passwordHash) {
  /** Verify a plaintext password against a bcrypt hash. */
  if (!passwordHash) return false;
  return bcrypt.compare(String(password || ''), String(passwordHash));
}

// PUBLIC_INTERFACE
function signAccessToken(user) {
  /** Sign a JWT access token for a user. */
  const expiresIn = getJwtExpiresInSeconds();
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn,
      issuer: getJwtIssuer(),
      audience: getJwtAudience(),
    }
  );
}

// PUBLIC_INTERFACE
function verifyAccessToken(token) {
  /** Verify and decode a JWT access token. Throws if invalid/expired. */
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    issuer: getJwtIssuer(),
    audience: getJwtAudience(),
  });
}

// PUBLIC_INTERFACE
function canAccess(requiredRole, actualRole) {
  /** Return true if actualRole has >= privileges of requiredRole. */
  const req = normalizeRole(requiredRole);
  const act = normalizeRole(actualRole);
  if (!req || !act) return false;

  const order = {
    operator: 1,
    supervisor: 2,
    manager: 3,
  };

  return order[act] >= order[req];
}

module.exports = {
  ALLOWED_ROLES,
  normalizeRole,
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  canAccess,
};
