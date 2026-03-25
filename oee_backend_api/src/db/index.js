const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

let dbInstance = null;

/**
 * Returns the on-disk path for the SQLite database file.
 * Uses env var SQLITE_DB_PATH if provided; otherwise defaults to ./data/oee.sqlite.
 */
function getDbFilePath() {
  const configured = process.env.SQLITE_DB_PATH;
  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }
  // Default inside container repo
  return path.join(__dirname, '..', '..', 'data', 'oee.sqlite');
}

/**
 * Ensures the directory for the DB file exists.
 */
function ensureDbDir(dbFilePath) {
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Executes the schema creation statements. Safe to run multiple times.
 */
function applySchema(db) {
  // Pragmas for better reliability
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // For simple migrations: track schema version.
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  // v1 schema
  const v1Applied = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(1);
  if (!v1Applied) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS lines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL, -- HH:MM
        end_time TEXT NOT NULL,   -- HH:MM
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS production_runs (
        id TEXT PRIMARY KEY,
        line_id TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
        shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL,
        product_code TEXT,
        started_at TEXT NOT NULL, -- ISO
        ended_at TEXT,            -- ISO
        planned_production_seconds INTEGER NOT NULL DEFAULT 0,
        ideal_cycle_time_seconds REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_production_runs_line_id ON production_runs(line_id);
      CREATE INDEX IF NOT EXISTS idx_production_runs_started_at ON production_runs(started_at);

      CREATE TABLE IF NOT EXISTS downtime_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES production_runs(id) ON DELETE CASCADE,
        reason TEXT,
        started_at TEXT NOT NULL, -- ISO
        ended_at TEXT,            -- ISO
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_downtime_events_run_id ON downtime_events(run_id);

      CREATE TABLE IF NOT EXISTS quality_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES production_runs(id) ON DELETE CASCADE,
        good_count INTEGER NOT NULL DEFAULT 0,
        reject_count INTEGER NOT NULL DEFAULT 0,
        occurred_at TEXT NOT NULL, -- ISO
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_quality_events_run_id ON quality_events(run_id);
      CREATE INDEX IF NOT EXISTS idx_quality_events_occurred_at ON quality_events(occurred_at);
    `);

    db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)').run(
      1,
      new Date().toISOString()
    );
  }
}

/**
 * Inserts a small set of seed data if the tables are empty.
 */
function seedIfNeeded(db) {
  const lineCount = db.prepare('SELECT COUNT(1) as c FROM lines').get().c;
  if (lineCount === 0) {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO lines(id, name, created_at) VALUES(?, ?, ?)').run('line-1', 'Line 1', now);
    db.prepare('INSERT INTO lines(id, name, created_at) VALUES(?, ?, ?)').run('line-2', 'Line 2', now);
  }

  const shiftCount = db.prepare('SELECT COUNT(1) as c FROM shifts').get().c;
  if (shiftCount === 0) {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO shifts(id, name, start_time, end_time, created_at) VALUES(?, ?, ?, ?, ?)').run(
      'shift-a',
      'Shift A',
      '06:00',
      '14:00',
      now
    );
    db.prepare('INSERT INTO shifts(id, name, start_time, end_time, created_at) VALUES(?, ?, ?, ?, ?)').run(
      'shift-b',
      'Shift B',
      '14:00',
      '22:00',
      now
    );
    db.prepare('INSERT INTO shifts(id, name, start_time, end_time, created_at) VALUES(?, ?, ?, ?, ?)').run(
      'shift-c',
      'Shift C',
      '22:00',
      '06:00',
      now
    );
  }
}

/**
 * PUBLIC_INTERFACE
 * Initializes and returns a singleton SQLite connection.
 * Also applies schema and seed data on first initialization.
 * @returns {import('better-sqlite3').Database}
 */
function getDb() {
  if (dbInstance) return dbInstance;

  const dbFilePath = getDbFilePath();
  ensureDbDir(dbFilePath);

  const db = new Database(dbFilePath);
  applySchema(db);
  seedIfNeeded(db);

  dbInstance = db;
  return dbInstance;
}

/**
 * PUBLIC_INTERFACE
 * Gracefully closes the database connection (if open).
 */
function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  getDb,
  closeDb,
};
