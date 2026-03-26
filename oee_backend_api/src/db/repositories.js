const { getDb } = require('./index');

function randomId(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

/**
 * PUBLIC_INTERFACE
 * List all production lines.
 * @returns {Promise<Array<{id: string, name: string, created_at: string}>>}
 */
async function listLines() {
  const db = getDb();
  const res = await db.query('SELECT id, name, created_at FROM lines ORDER BY name ASC');
  return res.rows;
}

/**
 * PUBLIC_INTERFACE
 * List shifts.
 * @returns {Promise<Array<{id: string, name: string, start_time: string, end_time: string, created_at: string}>>}
 */
async function listShifts() {
  const db = getDb();
  const res = await db.query(
    'SELECT id, name, start_time, end_time, created_at FROM shifts ORDER BY name ASC'
  );
  return res.rows;
}

/**
 * PUBLIC_INTERFACE
 * Creates a production run.
 * @param {object} payload
 * @returns {Promise<object>}
 */
async function createProductionRun(payload) {
  const db = getDb();
  const id = payload.id || randomId('run');

  await db.query(
    `
    INSERT INTO production_runs(
      id, line_id, shift_id, product_code, started_at, ended_at,
      planned_production_seconds, ideal_cycle_time_seconds, created_at
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())
  `,
    [
      id,
      payload.line_id,
      payload.shift_id || null,
      payload.product_code || null,
      payload.started_at,
      payload.ended_at || null,
      payload.planned_production_seconds || 0,
      payload.ideal_cycle_time_seconds || 0,
    ]
  );

  return getProductionRunById(id);
}

/**
 * PUBLIC_INTERFACE
 * Fetch a production run by id.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function getProductionRunById(id) {
  const db = getDb();
  const res = await db.query('SELECT * FROM production_runs WHERE id = $1', [id]);
  return res.rows[0] || null;
}

/**
 * PUBLIC_INTERFACE
 * Set ended_at for a production run.
 * @param {string} id
 * @param {string} ended_at
 * @returns {Promise<object|null>}
 */
async function endProductionRun(id, ended_at) {
  const db = getDb();
  const res = await db.query('UPDATE production_runs SET ended_at = $1 WHERE id = $2', [
    ended_at,
    id,
  ]);
  if (res.rowCount === 0) return null;
  return getProductionRunById(id);
}

/**
 * PUBLIC_INTERFACE
 * Create a downtime event.
 * @param {object} payload
 * @returns {Promise<object>}
 */
async function createDowntimeEvent(payload) {
  const db = getDb();
  const id = payload.id || randomId('down');

  await db.query(
    `
    INSERT INTO downtime_events(id, run_id, reason, started_at, ended_at, created_at)
    VALUES($1,$2,$3,$4,$5,NOW())
  `,
    [id, payload.run_id, payload.reason || null, payload.started_at, payload.ended_at || null]
  );

  const res = await db.query('SELECT * FROM downtime_events WHERE id = $1', [id]);
  return res.rows[0];
}

/**
 * PUBLIC_INTERFACE
 * Create a quality event (incremental snapshot).
 * @param {object} payload
 * @returns {Promise<object>}
 */
async function createQualityEvent(payload) {
  const db = getDb();
  const id = payload.id || randomId('qual');

  await db.query(
    `
    INSERT INTO quality_events(id, run_id, good_count, reject_count, occurred_at, created_at)
    VALUES($1,$2,$3,$4,$5,NOW())
  `,
    [
      id,
      payload.run_id,
      payload.good_count || 0,
      payload.reject_count || 0,
      payload.occurred_at,
    ]
  );

  const res = await db.query('SELECT * FROM quality_events WHERE id = $1', [id]);
  return res.rows[0];
}

/**
 * PUBLIC_INTERFACE
 * Aggregate downtime seconds for a run (ended events only, and open events up to now).
 * @param {string} runId
 * @returns {Promise<number>}
 */
async function getDowntimeSecondsForRun(runId) {
  const db = getDb();
  const res = await db.query('SELECT started_at, ended_at FROM downtime_events WHERE run_id = $1', [
    runId,
  ]);

  const now = Date.now();
  let total = 0;

  for (const r of res.rows) {
    const startMs = Date.parse(r.started_at);
    const endMs = r.ended_at ? Date.parse(r.ended_at) : now;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    total += Math.floor((endMs - startMs) / 1000);
  }

  return total;
}

/**
 * PUBLIC_INTERFACE
 * Aggregate good/reject totals for a run.
 * @param {string} runId
 * @returns {Promise<{good_total: number, reject_total: number}>}
 */
async function getQualityTotalsForRun(runId) {
  const db = getDb();
  const res = await db.query(
    `
    SELECT
      COALESCE(SUM(good_count), 0)::int as good_total,
      COALESCE(SUM(reject_count), 0)::int as reject_total
    FROM quality_events
    WHERE run_id = $1
  `,
    [runId]
  );

  return {
    good_total: res.rows[0]?.good_total ?? 0,
    reject_total: res.rows[0]?.reject_total ?? 0,
  };
}

/**
 * PUBLIC_INTERFACE
 * Fetch a user by email.
 * @param {string} email
 * @returns {Promise<{id: string, email: string, password_hash: string, role: string, is_active: boolean}|null>}
 */
async function getUserByEmail(email) {
  const db = getDb();
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  const res = await db.query(
    'SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1',
    [e]
  );
  return res.rows[0] || null;
}

/**
 * PUBLIC_INTERFACE
 * Fetch a user by id.
 * @param {string} id
 * @returns {Promise<{id: string, email: string, role: string, is_active: boolean}|null>}
 */
async function getUserById(id) {
  const db = getDb();
  const res = await db.query('SELECT id, email, role, is_active FROM users WHERE id = $1', [id]);
  return res.rows[0] || null;
}

/**
 * PUBLIC_INTERFACE
 * Create a new user.
 * @param {{email: string, password_hash: string, role: 'operator'|'supervisor'|'manager'}} payload
 * @returns {Promise<{id: string, email: string, role: string, is_active: boolean}>}
 */
async function createUser(payload) {
  const db = getDb();
  const id = payload.id || randomId('user');
  const email = String(payload.email || '').trim().toLowerCase();

  await db.query(
    `INSERT INTO users(id, email, password_hash, role, is_active, created_at, updated_at)
     VALUES($1,$2,$3,$4,TRUE,NOW(),NOW())`,
    [id, email, payload.password_hash, payload.role]
  );

  return getUserById(id);
}

module.exports = {
  listLines,
  listShifts,
  createProductionRun,
  getProductionRunById,
  endProductionRun,
  createDowntimeEvent,
  createQualityEvent,
  getDowntimeSecondsForRun,
  getQualityTotalsForRun,
  getUserByEmail,
  getUserById,
  createUser,
};
