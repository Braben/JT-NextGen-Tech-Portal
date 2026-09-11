const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { getIO } = require('./socket');
let transporter = null;
let twilioClient = null;

async function initEmail() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return;
  try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } catch {}
}

async function initSMS() {
  if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) return;
  try {
    twilioClient = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  } catch {}
}

function createNotification(type, userId, title, message, relatedId = null) {
  const id = uuidv4();
  db.prepare('INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, userId, title, message, type, relatedId);
  db.saveDb();
  const io = getIO();
  if (io) {
    const payload = { id, type, title, message, related_id: relatedId, created_at: new Date().toISOString() };
    // Emit both names while older route handlers/components still use the
    // plural event. Centralizing this keeps badges live during the migration.
    io.to(`user:${userId}`).emit('notification:new', payload);
    io.to(`user:${userId}`).emit('notifications:new', payload);
  }
  return id;
}

async function sendEmailNotification(userId, subject, htmlContent) {
  if (!transporter) return null;
  const user = db.prepare('SELECT email, name FROM users WHERE id = ?').get(userId);
  if (!user) return null;
  const logId = uuidv4();
  try {
    await transporter.sendMail({
      from: `"JT NextGen Tech Hub" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject,
      html: htmlContent,
    });
    db.prepare('INSERT INTO notification_log (id, user_id, channel, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(logId, userId, 'email', subject, htmlContent, 'sent');
    db.saveDb();
    return logId;
  } catch (err) {
    db.prepare('INSERT INTO notification_log (id, user_id, channel, subject, message, status, error) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(logId, userId, 'email', subject, htmlContent, 'failed', err.message);
    db.saveDb();
    return logId;
  }
}

async function sendSMSNotification(userId, message) {
  if (!twilioClient) return null;
  const user = db.prepare('SELECT phone FROM notification_settings WHERE user_id = ? AND phone IS NOT NULL').get(userId);
  const userProfile = db.prepare('SELECT phone FROM users WHERE id = ?').get(userId);
  const phone = user?.phone || userProfile?.phone;
  if (!phone) return null;
  const logId = uuidv4();
  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: phone,
    });
    db.prepare('INSERT INTO notification_log (id, user_id, channel, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(logId, userId, 'sms', '', message, 'sent');
    db.saveDb();
    return logId;
  } catch (err) {
    db.prepare('INSERT INTO notification_log (id, user_id, channel, subject, message, status, error) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(logId, userId, 'sms', '', message, 'failed', err.message);
    db.saveDb();
    return logId;
  }
}

async function notifyUser(userId, type, title, message, relatedId = null) {
  const notificationId = createNotification(type, userId, title, message, relatedId);
  const settings = db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(userId);
  if (!settings) return notificationId;
  if (settings.email_notifications && transporter) {
    sendEmailNotification(userId, title, `<h2>${title}</h2><p>${message}</p>`);
  }
  if (settings.sms_notifications && twilioClient) {
    sendSMSNotification(userId, `${title}: ${message}`);
  }
  return notificationId;
}

function sendInAppNotification(userId, title, message, type = 'info', relatedId = null) {
  return createNotification(type, userId, title, message, relatedId);
}

initEmail();
initSMS();

module.exports = { notifyUser, sendInAppNotification, sendEmailNotification, sendSMSNotification, createNotification };
