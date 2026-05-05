const nodemailer = require('nodemailer');
const { getBasicEmailTemplate } = require('./emailTemplates');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: parseInt(process.env.SMTP_PORT || '465') === 465, // true para 465, false para otros
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, title, message, actionText = '', actionUrl = '') => {
  const html = getBasicEmailTemplate(title, message, actionText, actionUrl);
  
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Correo enviado a ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Error enviando correo a ${to}:`, error);
    return false;
  }
};

module.exports = { sendEmail };
