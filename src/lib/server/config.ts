import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { resolve, join } from 'node:path';

const dataDir = resolve(env.DATA_DIR || '.data');

export const config = {
  dataDir,
  databasePath: resolve(env.DATABASE_PATH || join(dataDir, 'gestalt.sqlite')),
  uploadsDir: join(dataDir, 'uploads'),
  backupsDir: join(dataDir, 'backups'),
  sessionDays: Math.max(1, Number(env.SESSION_DAYS || 30)),
  cloudPaymentsApiSecret: env.CLOUDPAYMENTS_API_SECRET || '',
  cloudPaymentsWebhookSecret: env.CLOUDPAYMENTS_WEBHOOK_SECRET || env.CLOUDPAYMENTS_API_SECRET || '',
  cloudPaymentsPublicId: publicEnv.PUBLIC_CLOUDPAYMENTS_PUBLIC_ID || '',
  backupRetentionDays: Math.max(1, Number(env.BACKUP_RETENTION_DAYS || 14)),
  backupS3Endpoint: env.BACKUP_S3_ENDPOINT || '',
  backupS3Bucket: env.BACKUP_S3_BUCKET || '',
  backupS3Region: env.BACKUP_S3_REGION || 'us-east-1',
  backupS3AccessKey: env.BACKUP_S3_ACCESS_KEY || '',
  backupS3SecretKey: env.BACKUP_S3_SECRET_KEY || ''
};
