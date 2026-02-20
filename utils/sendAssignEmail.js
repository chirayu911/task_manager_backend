const nodemailer = require('nodemailer');
const path = require('path');

/**
 * @param {string} recipientEmail - User's email
 * @param {string} staffName - User's name
 * @param {string} taskTitle - Title of task
 * @param {string} description - Task details
 * @param {Array} files - Array of file paths (images/videos)
 * @param {string} type - 'assignment' or 'mention'
 */
const sendTaskEmail = async (recipientEmail, staffName, taskTitle, description = "", files = [], type = 'assignment') => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // ⭐ Logic: Prepare attachments for Nodemailer
    const attachments = files.map(filePath => ({
      filename: path.basename(filePath),
      path: path.resolve(filePath) // Resolves local path on your server
    }));

    // ⭐ Logic: Dynamic Header and Subject based on type
    const isMention = type === 'mention';
    const subject = isMention 
      ? `💬 You were mentioned in: ${taskTitle}` 
      : `📌 New Task Assigned: ${taskTitle}`;
    
    const headerColor = isMention ? '#ec4899' : '#4f46e5'; // Pink for mention, Indigo for assignment
    const icon = isMention ? '💬' : '📋';

    const mailOptions = {
      from: `"Task Management Portal" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: subject,
      attachments: attachments, // ⭐ Files attached here
      html: `
        <div style="background-color: #f9fafb; padding: 40px 0; font-family: 'Segoe UI', sans-serif;">
          <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #e5e7eb;">
            
            <div style="background-color: ${headerColor}; padding: 30px; text-align: center;">
              <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 10px; border-radius: 12px; margin-bottom: 15px;">
                <span style="font-size: 32px;">${icon}</span>
              </div>
              <h2 style="color: #ffffff; margin: 0; font-size: 22px;">${isMention ? 'New Mention' : 'New Assignment'}</h2>
            </div>

            <div style="padding: 40px 30px;">
              <p style="color: #374151; font-size: 16px;">Hi <strong>${staffName}</strong>,</p>
              
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
                ${isMention 
                  ? `You have been mentioned in a task discussion. Review the details below:` 
                  : `A new task has been assigned to you in the system.`}
              </p>
              
              <div style="background-color: #f3f4f6; border-left: 4px solid ${headerColor}; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <span style="color: #6b7280; font-size: 11px; text-transform: uppercase; font-weight: bold;">Task Title</span>
                <p style="color: #111827; font-size: 17px; font-weight: 700; margin: 5px 0 15px 0;">${taskTitle}</p>
                
                <span style="color: #6b7280; font-size: 11px; text-transform: uppercase; font-weight: bold;">Description</span>
                <p style="color: #4b5563; font-size: 14px; margin: 5px 0 0 0; white-space: pre-wrap;">${description || 'No description provided.'}</p>
              </div>

              ${attachments.length > 0 ? `
                <p style="color: #6b7280; font-size: 12px; margin-bottom: 10px;">📎 <strong>${attachments.length} Attachment(s)</strong> included in this email.</p>
              ` : ''}

              <div style="text-align: center; margin: 35px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tasks" 
                   style="background-color: ${headerColor}; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 600; display: inline-block;">
                   Open Task Manager
                </a>
              </div>
            </div>

            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #f3f4f6;">
              <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                Sent from the GPERI Task Automator<br/>
                &copy; 2026 Gujarat Power Engineering and Research Institute
              </p>
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ ${type.toUpperCase()} email sent to ${recipientEmail}`);
  } catch (error) {
    console.error('❌ Mailer Error:', error.message);
  }
};

module.exports = sendTaskEmail;