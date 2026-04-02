const crypto = require('crypto');

// The ENCRYPTION_KEY must be exactly 32 bytes (256 bits) for AES-256-CBC.
// Fallback key is provided for dev/testing, but it should be strongly overridden in production.
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'ab12cd34ef56gh78ij90kl12mn34op56'; // 32 characters
const ALGORITHM = 'aes-256-cbc';

const encryptMessage = (text) => {
  if (!text) return text;
  
  // Create a random Initialization Vector (IV) for each message
  const iv = crypto.randomBytes(16);
  // Create cipher using the key and IV
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
  
  let encrypted = cipher.update(text, 'utf-8', 'hex');
  encrypted += cipher.final('hex');

  // Return the IV concatenated with the encrypted data (separated by colon)
  return `${iv.toString('hex')}:${encrypted}`;
};

const decryptMessage = (encryptedText) => {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;

  try {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedData = textParts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  } catch (error) {
    console.error('Decryption failed for message: ', encryptedText);
    return '[Encrypted Message]';
  }
};

module.exports = {
  encryptMessage,
  decryptMessage
};
