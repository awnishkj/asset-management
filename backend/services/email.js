/**
 * services/email.js
 *
 * Email delivery via SendGrid Web API v3 (HTTPS — works on Render Free).
 * No SMTP, no Nodemailer, no blocked ports.
 *
 * Required environment variables:
 *   SENDGRID_API_KEY  — SendGrid API key (starts with SG.)
 *   EMAIL_FROM        — Verified sender address, e.g. "AssetTrack <no-reply@yourdomain.com>"
 *
 * Admin OTP recipient is always:
 *   ADMIN_EMAIL       — set in environment, never passed from client
 *
 * Usage:
 *   const { sendEmail } = require('../services/email');
 *   await sendEmail({ to, subject, text, html });
 */

const axios = require('axios');

console.log('Email provider: SendGrid API');

// Parse "Display Name <address@domain.com>" or plain "address@domain.com"
function parseAddress(raw) {
  if (!raw) return { email: '', name: 'AssetTrack' };
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { email: raw.trim(), name: 'AssetTrack' };
}

/**
 * Send an email via SendGrid v3 HTTPS API.
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 */
async function sendEmail({ to, subject, text, html }) {
  const from = parseAddress(process.env.EMAIL_FROM);
  const recipient = parseAddress(to);

  const payload = {
    personalizations: [
      {
        to: [{ email: recipient.email, name: recipient.name || recipient.email }],
      },
    ],
    from: { email: from.email, name: from.name || 'AssetTrack' },
    subject,
    content: [
      { type: 'text/plain', value: text },
      { type: 'text/html', value: html || text },
    ],
  };

  console.log('[email] Sending via SendGrid to:', recipient.email, '| subject:', subject);

  let response;
  try {
    response = await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
  } catch (err) {
    if (err.response) {
      console.error(
        '[email] SendGrid API error — status:', err.response.status,
        '| body:', JSON.stringify(err.response.data)
      );
      throw new Error(
        `SendGrid API error ${err.response.status}: ${JSON.stringify(err.response.data)}`
      );
    }
    console.error('[email] SendGrid request failed:', err.message);
    throw new Error(`SendGrid request failed: ${err.message}`);
  }

  // SendGrid returns 202 Accepted on success (no body)
  console.log('[email] SendGrid accepted — status:', response.status, '| to:', recipient.email);
}

module.exports = { sendEmail };
