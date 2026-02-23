const nodemailer = require('nodemailer');

const sendWelcomeEmail = async (email, name, username, password) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        // Use App Password from Google Account Security settings
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, 
      },
    });

    // Professional HTML Template
    const mailOptions = {
      from: `"Task Management System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🚀 Welcome aboard! Your login credentials inside',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
          <div style="background-color: #2563eb; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to the Team, ${name}!</h1>
          </div>
          <div style="padding: 30px; background-color: white;">
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Your account has been successfully created. You can now log in to the Task Management Portal using the credentials below:</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <table style="width: 100%;">
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

            <div style="text-align: center; margin: 35px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                 style="background-color: #2563eb; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                Get Started Now
              </a>
            </div>

            <div style="border-top: 1px solid #f3f4f6; padding-top: 20px;">
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                <strong>Security
              </p>
            </div>
          </div>
          <div style="background-color: #f9fafb; padding: 15px; text-align: center; color: #9ca3af; font-size: 12px;">
            &copy; 2026 Gujarat Power Engineering and Research Institute (GPERI)
          </div>
        </div>
      `,
    };

    const info = transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Email dispatch failed:', error);
    // As an AI, I suggest logging this to your DevOps dashboard
    throw new Error('Email delivery failed');
  }
};

module.exports = sendWelcomeEmail;