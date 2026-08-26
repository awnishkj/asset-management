/**
 * services/email.js
 *
 * Email delivery via Mailjet Send API v3.1 (HTTPS — works on Render Free).
 * No SMTP, no Nodemailer, no blocked ports.
 *
 * Required environment variables:
 *   MAIL_USER   — Mailjet API key   (public key)
 *   MAIL_PASS   — Mailjet secret key
 *   EMAIL_FROM  — Sender address, e.g. "AssetTrack <no-reply@yourdomain.com>"
 *                 or plain "no-reply@yourdomain.com"
 *
 * Usage:
 *   const { sendEmail } = require('../services/email');
 *   await sendEmail({ to, subject, text, html });
 */

const axios = require('axios');

console.log('Email provider: Mailjet API');

// Parse "Display Name <address@domain.com>" or plain "address@domain.com"
function parseAddress(raw) {
  if (!raw) return { Email: '', Name: '' };
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { Name: match[1].trim(), Email: match[2].trim() };
  return { Email: raw.trim(), Name: '' };
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 */
async function sendEmail({ to, subject, text, html }) {
  const from = parseAddress(process.env.EMAIL_FROM);
  const recipient = parseAddress(to);

  const payload = {
    Messages: [
      {
        From: { Email: from.Email, Name: from.Name || 'AssetTrack' },
        To: [{ Email: recipient.Email, Name: recipient.Name || recipient.Email }],
        Subject: subject,
        TextPart: text,
        HTMLPart: html || text,
      },
    ],
  };

  console.log('[email] Preparing Mailjet email:', {
    from: from.Email,
    to: recipient.Email,
    subject,
  });

  let response;
  try {
    response = await axios.post(
      'https://api.mailjet.com/v3.1/send',
      payload,
      {
        auth: {
          username: process.env.MAIL_USER,
          password: process.env.MAIL_PASS,
        },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
  } catch (err) {
    if (err.response) {
      console.error(
        '[email] Mailjet API error — status:', err.response.status,
        '| body:', JSON.stringify(err.response.data)
      );
      throw new Error(
        `Mailjet API error ${err.response.status}: ${JSON.stringify(err.response.data)}`
      );
    }
    console.error('[email] Mailjet request failed:', err.message);
    throw new Error(`Mailjet request failed: ${err.message}`);
  }

  const msg = response.data?.Messages?.[0];
  if (msg?.Status !== 'success') {
    console.error('[email] Mailjet rejected message — status:', msg?.Status, '| errors:', JSON.stringify(msg?.Errors));
    throw new Error(`Mailjet rejected message: ${msg?.Status}`);
  }

  console.log('[email] Mailjet API sent — MessageID:', msg?.To?.[0]?.MessageID, '| to:', to);
}

module.exports = { sendEmail };
