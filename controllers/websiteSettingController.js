const WebsiteSetting = require('../models/WebsiteSetting');
const path = require('path');
const fs = require('fs');

// Fetch the solitary Website Setting document
exports.getSettings = async (req, res) => {
  try {
    let settings = await WebsiteSetting.findOne();
    if (!settings) {
      settings = new WebsiteSetting({ logo: null, images: [], videos: [] });
      await settings.save();
    }
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching website settings', error: error.message });
  }
};

// Update the website settings and handle uploaded files
exports.updateSettings = async (req, res) => {
  try {
    const { existingImages, existingVideos } = req.body;
    
    // Parse arrays correctly, or default to empty array
    let processedExistingImages = [];
    if (existingImages) {
        processedExistingImages = Array.isArray(existingImages) ? existingImages : [existingImages];
    }
    
    let processedExistingVideos = [];
    if (existingVideos) {
        processedExistingVideos = Array.isArray(existingVideos) ? existingVideos : [existingVideos];
    }
    
    let settings = await WebsiteSetting.findOne();
    if (!settings) {
      settings = new WebsiteSetting();
    }

    // Process new files uploaded by multer
    // multer provides req.files as an object with arrays if we use upload.fields()
    if (req.files) {
      // Handle Logo upload (single file)
      if (req.files.logo && req.files.logo.length > 0) {
        // Option to delete the old logo if necessary (simplified here)
        settings.logo = req.files.logo[0].path.replace(/\\/g, "/"); 
      }

      // Process new images
      if (req.files.images && req.files.images.length > 0) {
        const newImages = req.files.images.map(f => f.path.replace(/\\/g, "/"));
        settings.images = [...processedExistingImages, ...newImages];
      } else {
        settings.images = processedExistingImages;
      }

      // Process new videos
      if (req.files.videos && req.files.videos.length > 0) {
        const newVideos = req.files.videos.map(f => f.path.replace(/\\/g, "/"));
        settings.videos = [...processedExistingVideos, ...newVideos];
      } else {
        settings.videos = processedExistingVideos;
      }
    } else {
      // No new files uploaded, just keep the existing ones maintained from the frontend array
      settings.images = processedExistingImages;
      settings.videos = processedExistingVideos;
    }

    await settings.save();

    res.status(200).json({ message: 'Website settings updated successfully', settings });
  } catch (error) {
    res.status(500).json({ message: 'Error updating website settings', error: error.message });
  }
};
