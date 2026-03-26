const { Pool } = require('pg');

let pool = null;

/**
 * PUBLIC_INTERFACE
 * Returns the configured PostgreSQL connection string.
 * @returns {string}
 */
function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim().length === 0) {
    throw new Error(
      'DATABASE_URL is not set. Please configure a PostgreSQL connection string in the environment.'
    );
  }
  return url.trim();
}

/**
 * PUBLIC_INTERFACE
 * Initialize and return a singleton pg Pool.
 * @returns {import('pg').Pool}
 */
function getDb() {
  if (pool) return pool;

  const connectionString = getDatabaseUrl();

  // Allow local dev with self-signed certs by toggling PGSSLMODE=require, etc.
  // This keeps defaults safe without hardcoding secrets.
  const ssl =
    String(process.env.PGSSLMODE || '').toLowerCase() === 'require'
      ? { rejectUnauthorized: false }
      : undefined;

  pool = new Pool({ connectionString, ssl });

  // Avoid unhandled errors crashing the process without context.
  pool.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Unexpected PostgreSQL pool error:', err);
  });

  return pool;
}

/**
 * Creates required tables and indexes if they do not exist.
 * Safe to run multiple times.
 * @param {import('pg').Pool} db
 */
async function applySchema(db) {
  // Keep statements mostly single-purpose for easier troubleshooting.
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL
    );
  `);

  // ---------------------------
  // Migration v1: core OEE data
  // ---------------------------
  const v1 = await db.query('SELECT 1 FROM schema_migrations WHERE version = $1', [1]);
  if (v1.rowCount === 0) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS lines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS production_runs (
        id TEXT PRIMARY KEY,
        line_id TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
        shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL,
        product_code TEXT,
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ,
        planned_production_seconds INTEGER NOT NULL DEFAULT 0,
        ideal_cycle_time_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_production_runs_line_id ON production_runs(line_id);'
    );
    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_production_runs_started_at ON production_runs(started_at);'
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS downtime_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES production_runs(id) ON DELETE CASCADE,
        reason TEXT,
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_downtime_events_run_id ON downtime_events(run_id);'
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS quality_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES production_runs(id) ON DELETE CASCADE,
        good_count INTEGER NOT NULL DEFAULT 0,
        reject_count INTEGER NOT NULL DEFAULT 0,
        occurred_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_quality_events_run_id ON quality_events(run_id);');
    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_quality_events_occurred_at ON quality_events(occurred_at);'
    );

    await db.query('INSERT INTO schema_migrations(version, applied_at) VALUES($1, NOW())', [1]);
  }

  // -------------------------------
  // Migration v2: authentication/RBAC
  // -------------------------------
  const v2 = await db.query('SELECT 1 FROM schema_migrations WHERE version = $1', [2]);
  if (v2.rowCount === 0) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('operator','supervisor','manager')),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');

    await db.query('INSERT INTO schema_migrations(version, applied_at) VALUES($1, NOW())', [2]);
  }
}

/**
 * Inserts a small set of seed data if tables are empty.
 * @param {import('pg').Pool} db
 */
async function seedIfNeeded(db) {
  const lineCountRes = await db.query('SELECT COUNT(1)::int as c FROM lines');
  if (lineCountRes.rows[0].c === 0) {
    await db.query('INSERT INTO lines(id, name, created_at) VALUES($1, $2, NOW())', [
      'line-1',
      'Line 1',
    ]);
    await db.query('INSERT INTO lines(id, name, created_at) VALUES($1, $2, NOW())', [
      'line-2',
      'Line 2',
    ]);
  }

  const shiftCountRes = await db.query('SELECT COUNT(1)::int as c FROM shifts');
  if (shiftCountRes.rows[0].c === 0) {
    await db.query(
      'INSERT INTO shifts(id, name, start_time, end_time, created_at) VALUES($1, $2, $3, $4, NOW())',
      ['shift-a', 'Shift A', '06:00', '14:00']
    );
    await db.query(
      'INSERT INTO shifts(id, name, start_time, end_time, created_at) VALUES($1, $2, $3, $4, NOW())',
      ['shift-b', 'Shift B', '14:00', '22:00']
    );
    await db.query(
      'INSERT INTO shifts(id, name, start_time, end_time, created_at) VALUES($1, $2, $3, $4, NOW())',
      ['shift-c', 'Shift C', '22:00', '06:00']
    );
  }

  // Seed an initial manager account (for first-time bootstrapping) if users table is empty.
  // Uses env vars so credentials are not hardcoded.
  //
  // Required env vars (set in deployment environment / .env):
  // - AUTH_SEED_MANAGER_EMAIL
  // - AUTH_SEED_MANAGER_PASSWORD
  // Optional:
  // - AUTH_SEED_MANAGER_ROLE (defaults to 'manager')
  const usersCountRes = await db.query('SELECT COUNT(1)::int as c FROM users');
  if (usersCountRes.rows[0].c === 0) {
    const email = String(process.env.AUTH_SEED_MANAGER_EMAIL || '').trim();
    const password = String(process.env.AUTH_SEED_MANAGER_PASSWORD || '').trim();
    const role = String(process.env.AUTH_SEED_MANAGER_ROLE || 'manager').trim() || 'manager';

    if (email && password) {
      // Lazy require to keep db module usable without auth deps in test contexts.
      // eslint-disable-next-line global-require
      const bcrypt = require('bcrypt');

      const hash = await bcrypt.hash(password, 12);
      await db.query(
        `INSERT INTO users(id, email, password_hash, role, is_active, created_at, updated_at)
         VALUES($1,$2,$3,$4,TRUE,NOW(),NOW())`,
        [`user_seed_${Date.now()}`, email.toLowerCase(), hash, role]
      );
    }
  }
}

/**
 * PUBLIC_INTERFACE
 * Initializes schema + seed data (idempotent). Call on server startup.
 * @returns {Promise<void>}
 */
async function initDb() {
  const db = getDb();
  await applySchema(db);
  await seedIfNeeded(db);
}

/**
 * PUBLIC_INTERFACE
 * Gracefully closes the database pool (if open).
 * @returns {Promise<void>}
 */
async function closeDb() {
  if (pool) {
    const p = pool;
    pool = null;
    await p.end();
  }
}

module.exports = {
  getDb,
  initDb,
  closeDb,
};
