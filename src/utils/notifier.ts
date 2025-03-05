import nodemailer from "nodemailer";
import twilio from "twilio";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

export const sendNotification = async (message: string) => {
  // Send email
  await transporter.sendMail({
    from: process.env.EMAIL_USER!,
    to: process.env.NOTIFY_EMAIL!,
    subject: "🚀 Care Central Bot Notification",
    text: message,
  });

  // Send SMS
  await twilioClient.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE!,
    to: process.env.NOTIFY_PHONE!,
  });

  console.log("✅ Notification Sent:", message);
};