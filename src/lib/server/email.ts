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

function registrationCodeText(input: { firstName: string; code: string; ttl: number }) {
  return [
    `Здравствуйте, ${input.firstName}!`,
    '',
    `Ваш код регистрации Gestalt.forum: ${input.code}`,
    '',
    `Он действует ${input.ttl} минут.`,
    'Если вы не запрашивали регистрацию, просто проигнорируйте это письмо.'
  ].join('\n');
}

function registrationCodeHtml(input: { firstName: string; code: string; ttl: number }) {
  const name = escapeHtml(input.firstName);
  const code = escapeHtml(input.code);
  const ttl = escapeHtml(String(input.ttl));

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Код регистрации Gestalt.forum</title>
  </head>
  <body style="margin:0; padding:0; background:#f4f0e8; color:#24241f;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      Ваш код регистрации Gestalt.forum: ${code}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; background:#f4f0e8;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; max-width:620px;">
            <tr>
              <td style="padding:0 0 18px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="width:46px; height:46px; border:1px solid #24241f; border-radius:999px; text-align:center; vertical-align:middle; font-family:Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; line-height:46px;">G.</td>
                    <td style="padding-left:12px; font-family:Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.02em;">Gestalt.forum</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#fffdf8; border:1px solid #c9c1b4; box-shadow:0 24px 70px rgba(55,47,37,.08); padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:36px 36px 22px;">
                      <div style="font-family:Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color:#b3442b; text-transform:uppercase; letter-spacing:.16em; font-size:12px; font-weight:700; margin-bottom:18px;">
                        Регистрация
                      </div>
                      <h1 style="margin:0; font-family:Georgia, 'Times New Roman', serif; font-size:42px; line-height:1.02; font-weight:500; letter-spacing:-.03em; color:#24241f;">
                        Код для входа в Gestalt.forum
                      </h1>
                      <p style="margin:22px 0 0; font-family:Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size:17px; line-height:1.65; color:#45443e;">
                        Здравствуйте, ${name}. Введите этот код на странице регистрации, чтобы подтвердить почту.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 36px;">
                      <div style="background:#e9e1d3; border:1px solid #c9c1b4; padding:24px; text-align:center;">
                        <div style="font-family:Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color:#716f66; text-transform:uppercase; letter-spacing:.16em; font-size:11px; font-weight:700; margin-bottom:10px;">
                          Ваш код
                        </div>
                        <div style="font-family:'SFMono-Regular', 'Roboto Mono', 'Menlo', 'Consolas', 'Courier New', monospace; font-size:46px; line-height:1; letter-spacing:.1em; font-weight:700; font-variant-numeric:tabular-nums; color:#b3442b; white-space:nowrap;">
                          ${code}
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:22px 36px 36px;">
                      <p style="margin:0 0 12px; font-family:Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size:15px; line-height:1.65; color:#716f66;">
                        Код действует ${ttl} минут. Если вы не запрашивали регистрацию, это письмо можно спокойно проигнорировать.
                      </p>
                      <div style="height:1px; background:#c9c1b4; margin:24px 0;"></div>
                      <p style="margin:0; font-family:Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size:13px; line-height:1.55; color:#716f66;">
                        Это автоматическое письмо. Пожалуйста, не отвечайте на него.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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

  const ttl = config.registrationCodeMinutes;

  const result = await client.emails.send({
    from: config.emailFrom,
    to: input.to,
    subject: 'Код регистрации Gestalt.forum',
    text: registrationCodeText({ firstName: input.firstName, code: input.code, ttl }),
    html: registrationCodeHtml({ firstName: input.firstName, code: input.code, ttl })
  });

  if (result.error) {
    return { ok: false, message: result.error.message || 'Resend rejected the email request.' };
  }

  return { ok: true, id: result.data?.id };
}
