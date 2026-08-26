/**
 * services/email.js
 *
 * Email delivery via Mailjet SMTP (Nodemailer).
 * Works on Render Free — uses HTTPS port 587 with STARTTLS.
 *
 * Required environment variables:
 *   MAIL_HOST   — e.g. in-v3.mailjet.com
 *   MAIL_PORT   — e.g. 587
 *   MAIL_USER   — Mailjet API key (public key)
 *   MAIL_PASS   — Mailjet secret key
 *   EMAIL_FROM  — e.g. "AssetTrack <no-reply@yourdomain.com>"
 *
 * Usage:
 *   const { sendEmail } = require('../services/email');
 *   await sendEmail({ to, subject, text, html });
 */

const nodemailer = require('nodemailer');

console.log('Email provider: Mailjet SMTP');

// Build transporter once at module load — shared across all calls
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || 587),
  secure: false,       // false for port 587 — STARTTLS is negotiated
  requireTLS: true,    // force STARTTLS upgrade
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Verify SMTP configuration at startup so errors appear in Render logs
transporter.verify((err) => {
  if (err) {
    console.error('[email] Mailjet SMTP configuration error:', err.message);
  } else {
    console.log('[email] Mailjet SMTP ready');
  }
});

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 */
async function sendEmail({ to, subject, text, html }) {
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html: html || text,
  });

  console.log('[email] Mailjet SMTP sent — messageId:', info.messageId, '| to:', to);
}

module.exports = { sendEmail };
