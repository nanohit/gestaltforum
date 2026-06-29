import { createReadStream, createWriteStream, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { createHash, createHmac } from 'node:crypto';
import { sqlite } from '$lib/server/db';
import { config } from '$lib/server/config';

let backupInProgress: Promise<string> | null = null;

function quoteSqliteString(value: string): string {
  return value.replaceAll("'", "''");
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const hmac = (key: Buffer | string, value: string) =>
  createHmac('sha256', key).update(value).digest();

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

async function uploadOffsite(path: string, name: string): Promise<void> {
  if (
    !config.backupS3Endpoint ||
    !config.backupS3Bucket ||
    !config.backupS3AccessKey ||
    !config.backupS3SecretKey
  ) {
    return;
  }
  const endpoint = new URL(config.backupS3Endpoint);
  const key = `gestalt-forum/${name}`;
  const encodedPath = [config.backupS3Bucket, ...key.split('/')]
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/${encodedPath}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const payloadHash = await hashFile(path);
  const canonicalHeaders =
    `content-type:application/gzip\n` +
    `host:${endpoint.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    endpoint.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  const scope = `${date}/${config.backupS3Region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const dateKey = hmac(`AWS4${config.backupS3SecretKey}`, date);
  const regionKey = hmac(dateKey, config.backupS3Region);
  const serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.backupS3AccessKey}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const size = statSync(path).size;
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      authorization,
      'content-type': 'application/gzip',
      'content-length': String(size),
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate
    },
    body: createReadStream(path) as never,
    duplex: 'half'
  } as RequestInit & { duplex: 'half' });
  if (!response.ok) {
    throw new Error(`S3 backup upload failed: ${response.status} ${await response.text()}`);
  }
}

export function listBackups() {
  if (!existsSync(config.backupsDir)) return [];
  return readdirSync(config.backupsDir)
    .filter((name) => name.endsWith('.sqlite.gz'))
    .map((name) => {
      const stats = statSync(join(config.backupsDir, name));
      return { name, size: stats.size, createdAt: stats.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createBackup(): Promise<string> {
  if (backupInProgress) return backupInProgress;
  backupInProgress = (async () => {
    const timestamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
    const sqliteName = `app-${timestamp}.sqlite`;
    const sqlitePath = join(config.backupsDir, sqliteName);
    const gzipPath = `${sqlitePath}.gz`;

    sqlite.exec(`VACUUM INTO '${quoteSqliteString(sqlitePath)}'`);
    await pipeline(createReadStream(sqlitePath), createGzip({ level: 6 }), createWriteStream(gzipPath));
    unlinkSync(sqlitePath);
    try {
      await uploadOffsite(gzipPath, basename(gzipPath));
    } catch (error) {
      console.error('Off-site backup copy failed; local backup is intact', error);
    }
    rotateBackups();
    return basename(gzipPath);
  })().finally(() => {
    backupInProgress = null;
  });
  return backupInProgress;
}

export function rotateBackups(): void {
  const cutoff = Date.now() - config.backupRetentionDays * 24 * 60 * 60 * 1000;
  for (const backup of listBackups()) {
    if (new Date(backup.createdAt).getTime() < cutoff) {
      unlinkSync(join(config.backupsDir, backup.name));
    }
  }
}

export function maybeRunScheduledBackup(): void {
  const latest = listBackups()[0];
  const age = latest ? Date.now() - new Date(latest.createdAt).getTime() : Infinity;
  if (age > 24 * 60 * 60 * 1000) {
    void createBackup().catch((error) => console.error('Scheduled backup failed', error));
  }
}

export function isSafeBackupName(name: string): boolean {
  return /^app-\d{4}-\d{2}-\d{2}T[\d-]+Z\.sqlite\.gz$/.test(name);
}
