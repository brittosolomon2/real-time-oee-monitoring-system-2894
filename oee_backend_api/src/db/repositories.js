const { getDb } = require('./index');

function isoNow() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

/**
 * PUBLIC_INTERFACE
 * List all production lines.
 */
function listLines() {
  const db = getDb();
  return db.prepare('SELECT id, name, created_at FROM lines ORDER BY name ASC').all();
}

/**
 * PUBLIC_INTERFACE
 * List shifts.
 */
function listShifts() {
  const db = getDb();
  return db.prepare('SELECT id, name, start_time, end_time, created_at FROM shifts ORDER BY name ASC').all();
}

/**
 * PUBLIC_INTERFACE
 * Creates a production run.
 */
function createProductionRun(payload) {
  const db = getDb();
  const id = payload.id || randomId('run');
  const now = isoNow();

  const stmt = db.prepare(`
    INSERT INTO production_runs(
      id, line_id, shift_id, product_code, started_at, ended_at,
      planned_production_seconds, ideal_cycle_time_seconds, created_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    payload.line_id,
    payload.shift_id || null,
    payload.product_code || null,
    payload.started_at,
    payload.ended_at || null,
    payload.planned_production_seconds || 0,
    payload.ideal_cycle_time_seconds || 0,
    now
  );

  return getProductionRunById(id);
}

/**
 * PUBLIC_INTERFACE
 * Fetch a production run by id.
 */
function getProductionRunById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM production_runs WHERE id = ?').get(id) || null;
}

/**
 * PUBLIC_INTERFACE
 * Set ended_at for a production run.
 */
function endProductionRun(id, ended_at) {
  const db = getDb();
  const info = db.prepare('UPDATE production_runs SET ended_at = ? WHERE id = ?').run(ended_at, id);
  if (info.changes === 0) return null;
  return getProductionRunById(id);
}

/**
 * PUBLIC_INTERFACE
 * Create a downtime event.
 */
function createDowntimeEvent(payload) {
  const db = getDb();
  const id = payload.id || randomId('down');
  const now = isoNow();

  db.prepare(`
    INSERT INTO downtime_events(id, run_id, reason, started_at, ended_at, created_at)
    VALUES(?, ?, ?, ?, ?, ?)
  `).run(
    id,
    payload.run_id,
    payload.reason || null,
    payload.started_at,
    payload.ended_at || null,
    now
  );

  return db.prepare('SELECT * FROM downtime_events WHERE id = ?').get(id);
}

/**
 * PUBLIC_INTERFACE
 * Create a quality event (incremental snapshot).
 */
function createQualityEvent(payload) {
  const db = getDb();
  const id = payload.id || randomId('qual');
  const now = isoNow();

  db.prepare(`
    INSERT INTO quality_events(id, run_id, good_count, reject_count, occurred_at, created_at)
    VALUES(?, ?, ?, ?, ?, ?)
  `).run(
    id,
    payload.run_id,
    payload.good_count || 0,
    payload.reject_count || 0,
    payload.occurred_at,
    now
  );

  return db.prepare('SELECT * FROM quality_events WHERE id = ?').get(id);
}

/**
 * PUBLIC_INTERFACE
 * Aggregate downtime seconds for a run (ended events only, and open events up to now).
 */
function getDowntimeSecondsForRun(runId) {
  const db = getDb();
  const rows = db.prepare('SELECT started_at, ended_at FROM downtime_events WHERE run_id = ?').all(runId);
  const now = Date.now();
  let total = 0;
  for (const r of rows) {
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
 */
function getQualityTotalsForRun(runId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(good_count), 0) as good_total,
      COALESCE(SUM(reject_count), 0) as reject_total
    FROM quality_events
    WHERE run_id = ?
  `).get(runId);

  return {
    good_total: row.good_total,
    reject_total: row.reject_total,
  };
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
};
