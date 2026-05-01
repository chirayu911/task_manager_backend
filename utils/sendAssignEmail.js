const nodemailer = require('nodemailer');
const path = require('path');

/**
 * @param {string} recipientEmail - User's email
 * @param {string} staffName - User's name
 * @param {string} taskTitle - Title of task/issue
 * @param {string} description - Details
 * @param {Array} files - Array of file paths
 * @param {string} type - 'assignment' or 'mention'
 * @param {string} itemType - 'Task' or 'Issue' 
 */
const sendTaskEmail = async (recipientEmail, staffName, taskTitle, description = "", files = [], type = 'assignment', itemType = 'Task' || 'Issue') => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: import.meta.env.EMAIL_USER,
        pass: import.meta.env.EMAIL_PASS
      }
    });

    const attachments = files.map(filePath => ({
      filename: path.basename(filePath),
      path: path.resolve(filePath)
    }));

    // ⭐ Normalization: Ensure 'issue' vs 'Issue' both trigger the red theme
    const normalizedType = itemType ? itemType.toLowerCase() : 'task';
    const isIssue = normalizedType === 'issue';
    const isTask = normalizedType === 'task';
    const isMention = type === 'mention';

    // ⭐ UI Configuration based on Item Type
    const headerColor = isIssue ? '#dc2626' : '#4f46e5'; // Red for Issues, Indigo for Tasks
    const label = isTask ? 'Task' : 'Issue';

    let subject = "";
    let icon = "";

    if (isTask) {
      icon = isMention ? '💬' : '⚠️';
      subject = isMention
        ? `💬 Mentioned in Task: ${taskTitle}`
        : `📌 New Task Assigned: ${taskTitle}`;
    }
    else if (isIssue) {
      icon = isMention ? '💬' : '📋';
      subject = isMention
        ? `🚨 Mentioned in Issue: ${taskTitle}`
        : `🚩 New Issue Assigned: ${taskTitle}`;
    }

    const mailOptions = {
      from: `"Task Management Portal" <${import.meta.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: subject,
      attachments: attachments,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 16px; border-top: 4px solid ${headerColor}; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <h2 style="color: #111827; margin-top: 0;">${isMention ? 'New Mention' : `New ${label} Assigned`}</h2>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Hi <strong>${staffName}</strong>,<br/>
              ${isMention
          ? `You have been mentioned in an <strong>${label.toLowerCase()}</strong> discussion.`
          : `A new <strong>${label.toLowerCase()}</strong> has been assigned to you.`}
            </p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; margin: 25px 0;">
              <div style="color: #6b7280; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 8px;">${label} Title</div>
              <div style="color: #111827; font-size: 18px; font-weight: bold; margin-bottom: 16px;">${taskTitle}</div>
              
              <div style="color: #6b7280; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 8px;">Description</div>
              <div style="color: #4b5563; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${description || 'No description provided.'}</div>
            </div>

            ${attachments.length > 0 ? `
              <p style="color: #6b7280; font-size: 12px; margin-bottom: 20px;">📎 <strong>${attachments.length} Attachment(s)</strong> included in this email.</p>
            ` : ''}

            <div style="margin-top: 30px;">
              <a href="${import.meta.env.FRONTEND_URL || 'http://localhost:3000'}/${isTask ? 'tasks' : 'issues'}" 
                 style="display: inline-block; padding: 14px 28px; background-color: ${headerColor}; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                View ${label}
              </a>
            </div>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center;">
              <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                Sent from Task Manager System &bull; &copy; 2026
              </p>
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ ${label} ${type.toUpperCase()} email sent to ${recipientEmail}`);
  } catch (error) {
    console.error('❌ Mailer Error:', error.message);
  }
};

module.exports = sendTaskEmail;