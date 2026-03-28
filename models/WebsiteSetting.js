const mongoose = require('mongoose');

const websiteSettingSchema = new mongoose.Schema({
  logo: {
    type: String, // Path to the logo image
    default: null
  },
  images: [{
    type: String // Paths to carousel images
  }],
  videos: [{
    type: String // Paths to showcase videos
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('WebsiteSetting', websiteSettingSchema);
