const nodemailer = require('nodemailer');

// Helper function to create the shared transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, 
    },
  });
};

// 1. Your Existing Welcome Email Function
const sendWelcomeEmail = async (email, name, username, password) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Task Management System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🚀 Welcome aboard! Your login credentials inside',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 16px; border-top: 4px solid #2563eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <h2 style="color: #111827; margin-top: 0;">Welcome to the Team, ${name}!</h2>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Your account has been successfully created. You can now log in to the Task Management Portal using the credentials below:
            </p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 25px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #6b7280; font-size: 14px; padding-bottom: 10px;">Username</td>
                  <td style="color: #111827; font-weight: bold; font-size: 15px; padding-bottom: 10px; text-align: right;">${username}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-size: 14px;">Temporary Password</td>
                  <td style="color: #ef4444; font-weight: bold; font-size: 15px; text-align: right;">${password}</td>
                </tr>
              </table>
            </div>

            <div style="margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                 style="display: inline-block; padding: 14px 28px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);">
                Get Started Now
              </a>
            </div>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center;">
              <p style="color: #9ca3af; font-size: 11px; margin-bottom: 5px;">
                <strong>Security Notice:</strong> Please change your password after logging in.
              </p>
              <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                &copy; 2026 Gujarat Power Engineering and Research Institute (GPERI)
              </p>
            </div>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Welcome Email dispatch failed:', error);
    throw new Error('Email delivery failed');
  }
};

const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Task Management System" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 16px; border-top: 4px solid #2563eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <h2 style="color: #111827; margin-top: 0;">Security Request</h2>
            <div style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
              ${options.text}
            </div>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center;">
              <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                &copy; 2026 Gujarat Power Engineering and Research Institute (GPERI)
              </p>
            </div>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password Reset Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Password Reset Email dispatch failed:', error);
    throw new Error('Email delivery failed');
  }
};

const sendLeaveRequestEmail = async (ownerEmail, employeeName, date, reason, frontendUrl) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"Task Management System" <${process.env.EMAIL_USER}>`,
      to: ownerEmail,
      subject: `Leave Request from ${employeeName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 16px; border-top: 4px solid #f59e0b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <h2 style="color: #111827; margin-top: 0;">New Leave Request</h2>
            <p style="color: #374151; font-size: 16px;">
              <strong>${employeeName}</strong> has requested leave on <strong>${date}</strong>.
            </p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong>Reason:</strong><br/>
              ${reason}
            </div>
            <a href="${frontendUrl}/attendance" 
               style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Review Request
            </a>
          </div>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    console.log('✅ Leave request email sent safely');
  } catch (error) {
    console.error('❌ Leave request email failed', error);
  }
};

const sendLeaveStatusEmail = async (employeeEmail, status, date) => {
  try {
    const transporter = createTransporter();
    const color = status === 'approved' ? '#10b981' : '#ef4444';
    const mailOptions = {
      from: `"Task Management System" <${process.env.EMAIL_USER}>`,
      to: employeeEmail,
      subject: `Leave Request ${status.toUpperCase()} for ${date}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 16px; border-top: 4px solid ${color};">
            <h2 style="color: #111827; margin-top: 0;">Your leave request for ${date} has been <strong>${status}</strong>.</h2>
            <p style="color: #374151;">Please check your dashboard or reach out to HR for more details mapping to your request.</p>
          </div>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    console.log('✅ Leave status email sent safely');
  } catch (error) {
    console.error('❌ Leave status email failed', error);
  }
};

// Export both functions
module.exports = {
  sendWelcomeEmail,
  sendEmail,
  sendLeaveRequestEmail,
  sendLeaveStatusEmail
};