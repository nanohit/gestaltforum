import { gzipSync } from 'node:zlib';
import { connection, pool, sqlite } from './db.ts';
export async function listBackups() {
  return await pool`SELECT name, octet_length(body) AS size, created_at AS "createdAt" FROM backups ORDER BY created_at DESC`;
}
export async function createBackup() {
  const name = `app-${new Date().toISOString().replaceAll(':','-')}.postgres.json.gz`;
  const body = await sqlite.transaction(async () => {
    const data: Record<string, unknown> = {};
    const tables = await connection()`SELECT tablename FROM pg_tables WHERE schemaname='gestalt' AND tablename NOT IN ('backups','rate_limits','sessions','email_verification_codes') ORDER BY tablename`;
    for(const {tablename} of tables) data[tablename] = await connection().unsafe(`SELECT * FROM gestalt."${tablename}"`);
    return gzipSync(JSON.stringify({ format: 'gestalt-postgres-v1', tables: data }));
  })();
  await pool`INSERT INTO backups(name,created_at,body) VALUES(${name},${new Date().toISOString()},${body})`;
  await pool`DELETE FROM backups WHERE created_at < ${new Date(Date.now()-14*86400000).toISOString()}`;
  return name;
}
export const isSafeBackupName = (name: string) => /^app-[\dTZ.\-]+\.postgres\.json\.gz$/.test(name);
