const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  screenshot: { type: String, default: null } // Path to uploaded screenshot
}, { _id: true });

const websiteSettingSchema = new mongoose.Schema({
  logo: {
    type: String,
    default: null
  },
  images: [{ type: String }],
  videos: [{ type: String }],
  features: [featureSchema],
  
  // New About Us / Contact Fields
  adminName: { type: String, default: '' },
  adminEmail: { type: String, default: '' },
  adminMobile: { type: String, default: '' },
  companyAddress: { type: String, default: '' },
  companyEmail: { type: String, default: '' },
  companyPhone: { type: String, default: '' }
}, {
  timestamps: true
});

module.exports = mongoose.model('WebsiteSetting', websiteSettingSchema);
