const WebsiteSetting = require('../models/WebsiteSetting');
const path = require('path');
const fs = require('fs');

// Fetch the solitary Website Setting document
exports.getSettings = async (req, res) => {
  try {
    let settings = await WebsiteSetting.findOne();
    if (!settings) {
      settings = new WebsiteSetting({ logo: null, images: [], videos: [], features: [] });
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
    const { 
      existingImages, existingVideos, featuresData,
      adminName, adminEmail, adminMobile,
      companyAddress, companyEmail, companyPhone
    } = req.body;
    
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
    
    // Update contact and admin fields
    settings.adminName = adminName || '';
    settings.adminEmail = adminEmail || '';
    settings.adminMobile = adminMobile || '';
    settings.companyAddress = companyAddress || '';
    settings.companyEmail = companyEmail || '';
    settings.companyPhone = companyPhone || '';

    // Process new files uploaded by multer
    if (req.files) {
      // Handle Logo upload (single file)
      if (req.files.logo && req.files.logo.length > 0) {
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
      settings.images = processedExistingImages;
      settings.videos = processedExistingVideos;
    }

    // Process features (title, description + per-feature screenshot)
    if (featuresData) {
      const parsedFeatures = JSON.parse(featuresData); // Array of { id, title, description, existingScreenshot }

      // Screenshot uploads are keyed as featureScreenshots_<index>
      // But we sent them all as 'featureScreenshots' with index context from order
      const uploadedScreenshots = req.files?.featureScreenshots?.map(f => f.path.replace(/\\/g, "/")) || [];

      let screenshotPointer = 0;
      settings.features = parsedFeatures.map((f) => {
        let screenshot = f.existingScreenshot || null;
        if (f.hasNewScreenshot) {
          screenshot = uploadedScreenshots[screenshotPointer++] || null;
        }
        return {
          _id: f._id || undefined,
          title: f.title || '',
          description: f.description || '',
          screenshot
        };
      });
    }

    await settings.save();

    res.status(200).json({ message: 'Website settings updated successfully', settings });
  } catch (error) {
    res.status(500).json({ message: 'Error updating website settings', error: error.message });
  }
};
