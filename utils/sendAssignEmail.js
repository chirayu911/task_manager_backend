const nodemailer = require('nodemailer');

const sendTaskEmail = async (recipientEmail, staffName, taskTitle) => {
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

    const mailOptions = {
      from: `"Task Management Portal" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: `📌 New Task Assigned: ${taskTitle}`,
      html: `
        <div style="background-color: #f9fafb; padding: 40px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #e5e7eb;">
            
            <div style="background-color: #4f46e5; padding: 30px; text-align: center;">
              <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 10px; border-radius: 12px; margin-bottom: 15px;">
                <span style="font-size: 32px;">📋</span>
              </div>
              <h2 style="color: #ffffff; margin: 0; font-size: 22px; letter-spacing: -0.5px;">New Assignment</h2>
            </div>

            <div style="padding: 40px 30px;">
              <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">Hi <strong>${staffName}</strong>,</p>
              
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">A new task has been assigned to you in the system. Here are the primary details:</p>
              
              <div style="background-color: #f3f4f6; border-left: 4px solid #4f46e5; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Task Title</span>
                <p style="color: #111827; font-size: 18px; font-weight: 700; margin: 5px 0 0 0;">${taskTitle}</p>
              </div>

              <div style="text-align: center; margin: 35px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tasks" 
                   style="background-color: #4f46e5; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);">
                   View Task Details
                </a>
              </div>

              <p style="color: #9ca3af; font-size: 13px; text-align: center; margin-top: 30px;">
                Please ensure you review the requirements and update the status regularly.
              </p>
            </div>

            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #f3f4f6;">
              <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                Sent from the Task Manager Automated System<br/>
                &copy; 2026 Gujarat Power Engineering and Research Institute (GPERI)
              </p>
            </div>

          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Task notification successfully sent to ${recipientEmail}`);
  } catch (error) {
    console.error('❌ Email Notification Error:', error.message);
  }
};

module.exports = sendTaskEmail;