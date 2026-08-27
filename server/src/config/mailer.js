// server/src/config/mailer.js
// Sends letters directly (real PDF attachment) via a Gmail account, instead
// of opening the user's own email client — Gmail's own compose deep link
// has no way to pre-attach a file, so this is the only way to get a real
// attachment into the recipient's inbox automatically.
import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("EMAIL_USER/EMAIL_PASS not configured");
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // a Google App Password, not the account's login password
    },
  });

  return transporter;
}

export async function sendMail({ to, subject, text, attachments }) {
  const t = getTransporter();
  return t.sendMail({
    from: `"SCUML Benin" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    attachments,
  });
}
