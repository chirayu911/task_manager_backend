const nodemailer = require('nodemailer');

const sendTaskEmail = async (recipientEmail, staffName, taskTitle) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail', // Or your preferred email provider
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"Task Manager" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: 'New Task Assigned',
      html: `
        <div style="font-family: sans-serif; border: 1px solid #eee; padding: 20px;">
          <h3>Hello, ${staffName}!</h3>
          <p>You have been assigned a new task: <strong>${taskTitle}</strong></p>
          <p>Please log in to the portal to view the details.</p>
          <hr />
          <small>This is an automated notification.</small>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email successfully sent to ${recipientEmail}`);
  } catch (error) {
    console.error('Email Error:', error);
  }
};

module.exports = sendTaskEmail;