import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';
import argon2 from 'argon2';
import { migrate, prepareDirectories } from './db.js';

const { dataDir, uploadsDir, backupsDir } = prepareDirectories();
console.log(`Data directory: ${dataDir}`);
console.log(`Uploads directory: ${uploadsDir}`);
console.log(`Backups directory: ${backupsDir}`);
const databasePath = migrate();

if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
  const sqlite = new Database(databasePath);
  const email = process.env.SEED_ADMIN_EMAIL.trim().toLowerCase();
  const existing = sqlite.prepare('SELECT id, role FROM users WHERE email = ?').get(email);
  if (!existing) {
    const passwordHash = await argon2.hash(process.env.SEED_ADMIN_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    });
    sqlite
      .prepare(`
        INSERT INTO users (email, phone, first_name, last_name, pwd_hash, role)
        VALUES (?, ?, 'Главный', 'Редактор', ?, 'admin')
      `)
      .run(email, process.env.SEED_ADMIN_PHONE || '+70000000000', passwordHash);
    console.log(`Bootstrap administrator created: ${email}`);
  } else if (existing.role !== 'admin') {
    sqlite
      .prepare("UPDATE users SET role = 'admin', status = 'active' WHERE id = ?")
      .run(existing.id);
    console.log(`Bootstrap administrator promoted: ${email}`);
  }
  sqlite.close();
}

const child = spawn(process.execPath, ['build/index.js'], {
  stdio: 'inherit',
  env: process.env
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
