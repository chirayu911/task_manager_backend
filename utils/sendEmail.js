const nodemailer = require('nodemailer');

const sendWelcomeEmail = async (email, name, username, password) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Task Manager Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to the Team - Your Account Credentials',
    html: `
      <h1>Welcome, ${name}!</h1>
      <p>Your account has been created successfully.</p>
      <p><strong>Login Details:</strong></p>
      <ul>
        <li><strong>Username:</strong> ${username}</li>
        <li><strong>Password:</strong> ${password}</li>
      </ul>
      <p>Please log in and change your password immediately.</p>
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = sendWelcomeEmail;