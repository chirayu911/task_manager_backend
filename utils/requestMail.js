const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Handles email notifications for the Restricted Document Access System
 * @param {Object} params - to, templateType, data
 */
const requestMail = async ({ to, templateType, data }) => {
  try {
    if (!import.meta.env.EMAIL_USER || !import.meta.env.EMAIL_PASS) {
      console.error("🔴 EMAIL CANCELLED: Missing EMAIL_USER or EMAIL_PASS in .env file.");
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: import.meta.env.EMAIL_USER,
        pass: import.meta.env.EMAIL_PASS,
      },
    });

    let subject = '';
    let htmlContent = '';

    // ⭐ devtunnel URL - Ensure this matches your active frontend tunnel
    const frontendUrl = "https://fm8bp5cj-3000.inc1.devtunnels.ms";

    if (templateType === 'access_granted') {
      subject = `✅ Access Granted: ${data.documentTitle}`;
      htmlContent = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <h2 style="color: #059669; margin-top: 0;">Permission Updated</h2>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              <strong>${data.uploaderName}</strong> has approved your request to access: <br/>
              <span style="font-weight: bold; color: #111827;">${data.documentTitle}</span>
            </p>
            <div style="margin-top: 30px;">
              <a href="${frontendUrl}/documents" 
                 style="display: inline-block; padding: 14px 28px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px;">
                View Document Now
              </a>
            </div>
          </div>
        </div>
      `;
    }
    else if (templateType === 'access_requested') {
      subject = `🔔 New Access Request: ${data.documentTitle}`;

      // ⭐ LOGIC: The path the user should land on AFTER login
      const destinationPath = `/documents/requests/${data.requestId}`;
      const reviewLink = `${frontendUrl}/login?redirect=${encodeURIComponent(destinationPath)}`;

      htmlContent = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 16px; border-top: 4px solid #2563eb;">
            <h2 style="color: #111827; margin-top: 0;">Access Request Received</h2>
            <p style="color: #374151; font-size: 16px;">
              <strong>${data.userName}</strong> is asking for permission to view:
            </p>
            <div style="background-color: #eff6ff; padding: 15px; border-radius: 8px; color: #1e40af; font-weight: bold; margin: 20px 0;">
              ${data.documentTitle}
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 25px;">
              Clicking the button below will take you to the login page. After signing in, the approval window will open automatically.
            </p>
            <a href="${reviewLink}" 
               style="display: inline-block; padding: 14px 28px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);">
              Review & Respond
            </a>
          </div>
        </div>
      `;
    }
    else if (templateType === 'access_declined') {
      subject = `Update on Access Request: ${data.documentTitle}`;
      htmlContent = `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #fff1f2; border-radius: 10px;">
            <h2 style="color: #be123c;">Access Declined</h2>
            <p style="color: #4b5563;">Your request for access to <strong>${data.documentTitle}</strong> was not approved at this time.</p>
          </div>
        `;
    }

    const mailOptions = {
      from: `"Task Manager Admin" <${import.meta.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error(`🔴 EMAIL FAILED:`, error.message);
    return false;
  }
};

module.exports = requestMail;