const nodemailer = require('nodemailer');
require('dotenv').config(); // Ensure env variables are loaded

/**
 * Reusable Email Utility with Built-in Templates
 * @param {Object} options - { to: string, templateType: string, data: Object }
 */
const requestMail = async ({ to, templateType, data }) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("🔴 EMAIL CANCELLED: Missing EMAIL_USER or EMAIL_PASS in .env file.");
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, 
      },
    });

    let subject = '';
    let htmlContent = '';

    // Generate HTML based on the requested template type
    if (templateType === 'access_granted') {
      subject = `Document Access Granted: ${data.documentTitle}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
          <h2 style="color: #111827;">Access Granted</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            <strong>${data.uploaderName}</strong> has granted you access to the restricted document: <strong>${data.documentTitle}</strong>.
          </p>
          <a href="https://fm8bp5cj-3000.inc1.devtunnels.ms/documents/view/${data.docId}" 
             style="display: inline-block; padding: 12px 24px; background-color: #10B981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">
            View Document
          </a>
        </div>
      `;
    } 
    else if (templateType === 'access_requested') {
      subject = `Document Access Request: ${data.documentTitle}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
          <h2 style="color: #111827;">Access Request</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            <strong>${data.userName}</strong> has requested access to view your restricted document: <strong>${data.documentTitle}</strong>.
          </p>
          <p style="color: #4b5563; margin-bottom: 20px;">
            Please log in to your Task Manager to review the request and add them to the allowed users list.
          </p>
          <a href="https://fm8bp5cj-3000.inc1.devtunnels.ms/documents/edit/${data.docId}" 
             style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Review Request
          </a>
        </div>
      `;
    }

    const mailOptions = {
      from: `"Task Manager Admin" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email successfully sent to: ${to} [Template: ${templateType}]`);
    return info;

  } catch (error) {
    console.error(`🔴 EMAIL FAILED to ${to}. Reason:`, error.message);
  }
};

module.exports = requestMail;