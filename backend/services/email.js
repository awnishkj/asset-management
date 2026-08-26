/**
 * services/email.js
 *
 * Email delivery via Resend HTTPS API.
 * Works on Render Free (no SMTP ports required).
 *
 * Required environment variables:
 *   RESEND_API_KEY  — API key from resend.com (starts with re_)
 *   EMAIL_FROM      — Sender address, e.g. "AssetTrack <no-reply@yourdomain.com>"
 *
 * Usage:
 *   const { sendEmail } = require('../services/email');
 *   await sendEmail({ to, subject, text, html });
 */

const { Resend } = require('resend');

console.log('Email provider: Resend');

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 */
async function sendEmail({ to, subject, text, html }) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: [to],
    subject,
    text,
    html: html || text,
  });

  if (error) {
    console.error('[email] Resend error:', error);
    throw new Error(error.message || 'Failed to send email');
  }

  console.log('[email] Resend email sent successfully:', data?.id);
}

module.exports = { sendEmail };
