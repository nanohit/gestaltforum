const env = Deno.env.toObject();
export const config = {
  sessionDays: Math.max(1, Number(env.SESSION_DAYS || 30)),
  resendApiKey: env.RESEND_API_KEY || '',
  emailFrom: env.EMAIL_FROM || 'Gestalt.forum <onboarding@resend.dev>',
  registrationCodeMinutes: Math.max(3, Number(env.REGISTRATION_CODE_MINUTES || 10)),
  cloudPaymentsApiSecret: env.CLOUDPAYMENTS_API_SECRET || '',
  cloudPaymentsWebhookSecret: env.CLOUDPAYMENTS_WEBHOOK_SECRET || env.CLOUDPAYMENTS_API_SECRET || '',
  cloudPaymentsPublicId: env.PUBLIC_CLOUDPAYMENTS_PUBLIC_ID || ''
};
