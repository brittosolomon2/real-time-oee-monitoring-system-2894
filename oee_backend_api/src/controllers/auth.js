const { getUserByEmail, createUser } = require('../db/repositories');
const { verifyPassword, signAccessToken, hashPassword, normalizeRole } = require('../services/auth');

class AuthController {
  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Login and obtain a JWT access token
   *     description: |
   *       Authenticate with email + password and receive a JWT access token.
   *       Use `Authorization: Bearer <token>` on protected endpoints.
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email:
   *                 type: string
   *                 example: manager@example.com
   *               password:
   *                 type: string
   *                 example: change-me-please
   *     responses:
   *       200:
   *         description: Logged in successfully
   *       401:
   *         description: Invalid credentials
   */
  async login(req, res) {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'email and password are required' });
    }

    const user = await getUserByEmail(email);
    if (!user || user.is_active === false) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const token = signAccessToken({ id: user.id, email: user.email, role: user.role });

    return res.status(200).json({
      data: {
        access_token: token,
        token_type: 'Bearer',
        expires_in: Number(process.env.JWT_EXPIRES_IN_SECONDS || 28800),
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
    });
  }

  /**
   * Manager-only endpoint to create users.
   * Note: This is intended for early-stage deployments. In production, integrate with SSO/IdP.
   *
   * @swagger
   * /api/auth/users:
   *   post:
   *     summary: Create a user (manager only)
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password, role]
   *             properties:
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *                 description: Plaintext password (min 8 chars)
   *               role:
   *                 type: string
   *                 enum: [operator, supervisor, manager]
   *     responses:
   *       201:
   *         description: Created user
   *       409:
   *         description: Email already exists
   */
  async createUser(req, res) {
    const { email, password, role } = req.body || {};
    if (!email || !password || !role) {
      return res
        .status(400)
        .json({ status: 'error', message: 'email, password, and role are required' });
    }

    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid role. Must be one of operator, supervisor, manager.',
      });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ status: 'error', message: 'Email already exists' });
    }

    const password_hash = await hashPassword(password);
    const created = await createUser({ email, password_hash, role: normalizedRole });
    return res.status(201).json({ data: created });
  }
}

module.exports = new AuthController();
