const Activity = require('../models/Activity');

const logActivity = async ({ user, targetUser, company, project, action, resourceType, resourceId, description }) => {
  try {
    // We use a "Fire and Forget" approach or await depending on preference
    await Activity.create({
      user, 
      targetUser, 
      company, 
      project, 
      action, 
      resourceType, 
      resourceId, 
      description
    });
  } catch (err) {
    console.error("Activity Logging Failed:", err);
  }
};

module.exports = logActivity;