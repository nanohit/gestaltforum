import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { building } from '$app/environment';
import { resolve, join } from 'node:path';

const configuredDataDir = env.DATA_DIR || '.data';
const dataDir = resolve(building ? '.data/build' : configuredDataDir);
const databasePath = resolve(
  building ? join(dataDir, 'gestalt.sqlite') : env.DATABASE_PATH || join(dataDir, 'gestalt.sqlite')
);

const cleanSecret = (value: string | undefined, placeholders: string[] = []) => {
  const trimmed = value?.trim() || '';
  if (!trimmed) return '';
  if (placeholders.includes(trimmed)) return '';
  return trimmed;
};

export const config = {
  dataDir,
  databasePath,
  uploadsDir: join(dataDir, 'uploads'),
  backupsDir: join(dataDir, 'backups'),
  sessionDays: Math.max(1, Number(env.SESSION_DAYS || 30)),
  resendApiKey: cleanSecret(env.RESEND_API_KEY, ['re_xxxxxxxxx']),
  emailFrom: env.EMAIL_FROM || 'Gestalt.forum <onboarding@resend.dev>',
  registrationCodeMinutes: Math.max(3, Number(env.REGISTRATION_CODE_MINUTES || 10)),
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
