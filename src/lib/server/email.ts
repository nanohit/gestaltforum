import { Resend } from 'resend';
import { config } from '$lib/server/config';

let resend: Resend | null = null;

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

function getResend(): Resend | null {
  if (!config.resendApiKey) return null;
  resend ??= new Resend(config.resendApiKey);
  return resend;
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(config.resendApiKey && config.emailFrom);
}

export async function sendRegistrationCodeEmail(input: {
  to: string;
  firstName: string;
  code: string;
}): Promise<{ ok: true; id?: string } | { ok: false; message: string }> {
  const client = getResend();
  if (!client || !config.emailFrom) {
    return {
      ok: false,
      message: 'Email provider is not configured. Set RESEND_API_KEY and EMAIL_FROM.'
    };
  }

  const name = escapeHtml(input.firstName);
  const code = escapeHtml(input.code);
  const ttl = config.registrationCodeMinutes;

  const result = await client.emails.send({
    from: config.emailFrom,
    to: input.to,
    subject: 'Код регистрации Gestalt.forum',
    text: `Здравствуйте, ${input.firstName}!\n\nВаш код регистрации Gestalt.forum: ${input.code}\n\nОн действует ${ttl} минут. Если вы не запрашивали регистрацию, просто проигнорируйте это письмо.`,
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; color: #2f2b24; line-height: 1.55;">
        <p>Здравствуйте, ${name}!</p>
        <p>Ваш код регистрации Gestalt.forum:</p>
        <p style="font-size: 28px; letter-spacing: 0.16em; font-weight: 700; margin: 24px 0;">${code}</p>
        <p>Он действует ${ttl} минут. Если вы не запрашивали регистрацию, просто проигнорируйте это письмо.</p>
      </div>
    `
  });

  if (result.error) {
    return { ok: false, message: result.error.message || 'Resend rejected the email request.' };
  }

  return { ok: true, id: result.data?.id };
}
