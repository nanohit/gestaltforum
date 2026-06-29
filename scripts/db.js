import Database from 'better-sqlite3';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function paths() {
  const dataDir = resolve(process.env.DATA_DIR || '.data');
  const databasePath = resolve(process.env.DATABASE_PATH || join(dataDir, 'gestalt.sqlite'));
  return {
    dataDir,
    databasePath,
    uploadsDir: join(dataDir, 'uploads'),
    backupsDir: join(dataDir, 'backups')
  };
}

export function prepareDirectories() {
  const result = paths();
  mkdirSync(result.dataDir, { recursive: true });
  mkdirSync(dirname(result.databasePath), { recursive: true });
  mkdirSync(result.uploadsDir, { recursive: true });
  mkdirSync(result.backupsDir, { recursive: true });
  return result;
}

export function migrate() {
  const { databasePath } = prepareDirectories();
  const sqlite = new Database(databasePath);
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
    const sql = readFileSync(join(migrationDir, name), 'utf8');
    sqlite.transaction(() => {
      sqlite.exec(sql);
      record.run(name);
    })();
    console.log(`Applied migration ${name}`);
  }

  sqlite.close();
  return databasePath;
}
