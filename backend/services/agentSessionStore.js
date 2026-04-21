const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'app.db');

function getDb() {
  return new Database(DB_PATH);
}

function initTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_agent_sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      TEXT NOT NULL,
      session_id   TEXT NOT NULL,
      birth_date   TEXT,
      time_index   INTEGER,
      gender       TEXT,
      occupation   TEXT,
      user_fate    TEXT,
      created_at   TEXT DEFAULT (datetime('now')),
      updated_at   TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, session_id)
    )
  `);
  db.close();
}

function upsertSession({ userId, sessionId, birthDate, timeIndex, gender, occupation, userFate }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO ai_agent_sessions
      (user_id, session_id, birth_date, time_index, gender, occupation, user_fate, updated_at)
    VALUES
      (@userId, @sessionId, @birthDate, @timeIndex, @gender, @occupation, @userFate, datetime('now'))
    ON CONFLICT(user_id, session_id) DO UPDATE SET
      birth_date = excluded.birth_date,
      time_index = excluded.time_index,
      gender     = excluded.gender,
      occupation = excluded.occupation,
      user_fate  = excluded.user_fate,
      updated_at = datetime('now')
  `);
  stmt.run({ userId, sessionId, birthDate, timeIndex, gender, occupation, userFate });
  db.close();
}

// Initialize table on first require
initTable();

module.exports = { upsertSession };
