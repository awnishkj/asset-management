/**
 * services/email.js
 *
 * Email delivery via Gmail SMTP (Nodemailer).
 * All environment variables are read at call time — never hardcoded.
 *
 * Required environment variables:
 *   SMTP_HOST   e.g. smtp.gmail.com
 *   SMTP_PORT   e.g. 465
 *   SMTP_SECURE e.g. true
 *   SMTP_USER   e.g. you@gmail.com
 *   SMTP_PASS   Gmail App Password
 *   SMTP_FROM   e.g. AssetTrack <you@gmail.com>  (optional, defaults to SMTP_USER)
 *
 * Usage:
 *   const { sendEmail } = require('../services/email');
 *   await sendEmail({ to, subject, text, html });
 */

const nodemailer = require('nodemailer');

console.log('Email provider: Gmail SMTP');

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 */
async function sendEmail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error(
      'SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in your environment variables.'
    );
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html: html || text,
  });

  console.log('[email] Sent via Gmail SMTP — messageId:', info.messageId, '| to:', to);
}

module.exports = { sendEmail };
