/**
 * services/email.js
 *
 * Email sending abstraction for AssetTrack.
 *
 * Strategy (checked in order):
 *  1. RESEND_API_KEY set  → use Resend HTTP API  (works on Render Free)
 *  2. SMTP_HOST + SMTP_USER + SMTP_PASS set → use Nodemailer SMTP (local / self-hosted)
 *  3. development fallback → Nodemailer Ethereal test account (logs preview URL)
 *  4. production with no provider configured → throw a clear error
 *
 * Usage:
 *   const { sendEmail } = require('../services/email');
 *   await sendEmail({ to, subject, text, html });
 */

const nodemailer = require('nodemailer');

// ─── Resend (HTTP API — works on Render Free) ───────────────────────────────

async function sendViaResend({ to, subject, text, html }) {
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const from = process.env.EMAIL_FROM || 'AssetTrack <onboarding@resend.dev>';

  const { data, error } = await resend.emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
    html: html || `<pre style="font-family:sans-serif">${text}</pre>`,
  });

  if (error) {
    console.error('[email] Resend API error:', error.name, error.message);
    throw new Error(`Resend failed: ${error.message}`);
  }

  console.log('[email] Sent via Resend — id:', data?.id, '| to:', to);
}

// ─── Nodemailer SMTP (local dev / self-hosted) ────────────────────────────

async function sendViaSmtp({ to, subject, text, html }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com';

  const info = await transporter.sendMail({ from, to, subject, text, html });
  console.log('[email] Sent via SMTP — messageId:', info.messageId, '| to:', to);
}

// ─── Nodemailer Ethereal (dev fallback — logs preview URL) ───────────────

async function sendViaEthereal({ to, subject, text, html }) {
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });

  const info = await transporter.sendMail({
    from: 'AssetTrack Dev <no-reply@example.com>',
    to,
    subject,
    text,
    html,
  });

  console.log('[email] DEV — Ethereal preview URL:', nodemailer.getTestMessageUrl(info));
}

// ─── Main sendEmail function ──────────────────────────────────────────────

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 */
async function sendEmail({ to, subject, text, html }) {
  // 1. Resend (production-safe HTTP API)
  if (process.env.RESEND_API_KEY) {
    return sendViaResend({ to, subject, text, html });
  }

  // 2. SMTP (local dev or self-hosted)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return sendViaSmtp({ to, subject, text, html });
  }

  // 3. Dev fallback — Ethereal
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[email] No email provider configured — using Ethereal test account');
    return sendViaEthereal({ to, subject, text, html });
  }

  // 4. Production with nothing configured — fail clearly
  throw new Error(
    'No email provider configured. Set RESEND_API_KEY (recommended for Render) ' +
    'or SMTP_HOST + SMTP_USER + SMTP_PASS in your environment variables.'
  );
}

module.exports = { sendEmail };
