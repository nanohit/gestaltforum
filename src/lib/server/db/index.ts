import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { config } from '$lib/server/config';
import * as schema from './schema';

type DbState = {
  sqlite: Database.Database;
  db: ReturnType<typeof drizzle<typeof schema>>;
};

function initialize(): DbState {
  mkdirSync(config.dataDir, { recursive: true });
  mkdirSync(config.uploadsDir, { recursive: true });
  mkdirSync(config.backupsDir, { recursive: true });
  mkdirSync(dirname(config.databasePath), { recursive: true });

  const sqlite = new Database(config.databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('mmap_size = 134217728');
  sqlite.pragma('temp_store = MEMORY');
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrationDir = resolve('migrations');
  const applied = sqlite.prepare('SELECT 1 FROM _migrations WHERE name = ?');
  const record = sqlite.prepare('INSERT INTO _migrations (name) VALUES (?)');
  for (const name of readdirSync(migrationDir).filter((file) => file.endsWith('.sql')).sort()) {
    if (applied.get(name)) continue;
    const migration = readFileSync(join(migrationDir, name), 'utf8');
    sqlite.transaction(() => {
      sqlite.exec(migration);
      record.run(name);
    })();
  }

  sqlite.prepare("DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')").run();

  return { sqlite, db: drizzle(sqlite, { schema }) };
}

const globalDb = globalThis as typeof globalThis & { __gestaltDb?: DbState };
const state = globalDb.__gestaltDb ?? initialize();
if (process.env.NODE_ENV !== 'production') globalDb.__gestaltDb = state;

export const sqlite = state.sqlite;
export const db = state.db;
export { schema };
