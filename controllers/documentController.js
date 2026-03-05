const Document = require('../models/Document');
const User = require('../models/User'); 
const fs = require('fs');
const path = require('path');
const requestMail = require('../utils/requestMail'); 

// ==========================================
// 1. Create a New Document
// ==========================================
exports.createDocument = async (req, res) => {
  try {
    const { title, description, project, accessType, uploadedBy } = req.body;
    
    let allowedUsers = [];
    if (req.body.allowedUsers) {
      try { allowedUsers = JSON.parse(req.body.allowedUsers); } 
      catch (e) { console.error("Warning: Could not parse allowedUsers"); }
    }

    if (!req.file) return res.status(400).json({ message: "A document file is required." });

    const uploaderId = req.user?._id || req.user?.id || uploadedBy || null;
    const uploaderName = req.user?.name || "A team member";

    const newDoc = new Document({
      title,
      description,
      project,
      accessType: accessType || 'public',
      allowedUsers,
      fileUrl: `uploads/documents/${req.file.filename}`,
      originalName: req.file.originalname,
      fileType: req.file.originalname.split('.').pop().toUpperCase(),
      uploadedBy: uploaderId
    });

    await newDoc.save();

    if (accessType === 'restricted' && allowedUsers.length > 0) {
      const usersToNotify = await User.find({ _id: { $in: allowedUsers } });
      usersToNotify.forEach(user => {
        if (user.email) {
          requestMail({
            to: user.email,
            templateType: 'access_granted',
            data: { uploaderName: uploaderName, documentTitle: title, docId: newDoc._id }
          });
        }
      });
    }

    res.status(201).json(newDoc);
  } catch (error) {
    console.error("🔴 CREATE DOC ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to upload document." });
  }
};

// ==========================================
// 2. Get All Documents for a Project
// ==========================================
exports.getDocumentsByProject = async (req, res) => {
  try {
    const projectId = req.query.project;
    if (!projectId) return res.status(400).json({ message: "Project ID is required." });

    const documents = await Document.find({ project: projectId })
      .populate('uploadedBy', 'name email')
      .populate('allowedUsers', 'name email _id')
      .sort({ createdAt: -1 });

    res.status(200).json(documents);
  } catch (error) {
    console.error("🔴 GET DOCS ERROR:", error);
    res.status(500).json({ message: "Failed to retrieve documents." });
  }
};

// ==========================================
// 3. Get Single Document by ID
// ==========================================
exports.getDocumentById = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('uploadedBy', 'name email')
      .populate('allowedUsers', 'name email _id');
      
    if (!doc) return res.status(404).json({ message: "Document not found." });
    res.status(200).json(doc);
  } catch (error) {
    console.error("🔴 GET DOC ERROR:", error);
    res.status(500).json({ message: "Error fetching document." });
  }
};

// ==========================================
// 4. Update Document
// ==========================================
exports.updateDocument = async (req, res) => {
  try {
    const { title, description, accessType } = req.body;
    
    let allowedUsers = [];
    if (req.body.allowedUsers) {
      try { allowedUsers = JSON.parse(req.body.allowedUsers); } 
      catch (e) { console.error("Warning: Could not parse allowedUsers"); }
    }

    const oldDoc = await Document.findById(req.params.id);
    if (!oldDoc) return res.status(404).json({ message: "Document not found." });

    let updateData = { title, description, accessType, allowedUsers };

    if (req.file) {
      updateData.fileUrl = `uploads/documents/${req.file.filename}`;
      updateData.originalName = req.file.originalname;
      updateData.fileType = req.file.originalname.split('.').pop().toUpperCase();
    } else if (!req.body.existingFile) {
      return res.status(400).json({ message: "A document file is required." });
    }

    const updatedDoc = await Document.findByIdAndUpdate(req.params.id, updateData, { new: true });
    
    if (accessType === 'restricted' && allowedUsers.length > 0) {
      const oldUsersStr = oldDoc.allowedUsers.map(id => id.toString());
      const newlyAddedIds = allowedUsers.filter(id => !oldUsersStr.includes(id.toString()));

      if (newlyAddedIds.length > 0) {
        const usersToNotify = await User.find({ _id: { $in: newlyAddedIds } });
        const uploaderName = req.user?.name || "A team member";

        usersToNotify.forEach(user => {
          if (user.email) {
            requestMail({
              to: user.email,
              templateType: 'access_granted',
              data: { uploaderName: uploaderName, documentTitle: title, docId: updatedDoc._id }
            });
          }
        });
      }
    }

    res.status(200).json(updatedDoc);
  } catch (error) {
    console.error("🔴 UPDATE DOC ERROR:", error);
    res.status(500).json({ message: "Failed to update document." });
  }
};

// ==========================================
// 5. Delete Document
// ==========================================
exports.deleteDocument = async (req, res) => {
  try {
    const deletedDoc = await Document.findByIdAndDelete(req.params.id);
    if (!deletedDoc) return res.status(404).json({ message: "Document not found." });
    
    if (deletedDoc.fileUrl) {
      const filePath = path.join(__dirname, '..', deletedDoc.fileUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    
    res.status(200).json({ message: "Document deleted successfully." });
  } catch (error) {
    console.error("🔴 DELETE DOC ERROR:", error);
    res.status(500).json({ message: "Failed to delete document." });
  }
};

// ==========================================
// 6. Request Access to Restricted Document
// ==========================================
exports.requestAccess = async (req, res) => {
  try {
    const docId = req.params.id;
    const userId = req.user?._id || req.body.userId; 
    const userName = req.user?.name || req.body.userName || "A team member";

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User identification missing." });
    }

    const document = await Document.findById(docId).populate('uploadedBy', 'name email');
    if (!document) return res.status(404).json({ message: "Document not found." });

    // Fallback if accessRequests array isn't natively initialized
    if (!document.accessRequests) document.accessRequests = [];

    if (!document.accessRequests.includes(userId)) {
      document.accessRequests.push(userId);
      await document.save();
    }

    // Call requestMail cleanly with templateType and data!
    if (document.uploadedBy && document.uploadedBy.email) {
      const creatorEmail = document.uploadedBy.email;
      
      requestMail({
        to: creatorEmail,
        templateType: 'access_requested',
        data: {
          userName: userName,
          documentTitle: document.title,
          docId: docId
        }
      });
    }

    res.status(200).json({ message: "Access request sent successfully." });
  } catch (error) {
    console.error("🔴 REQ ACCESS ERROR:", error);
    res.status(500).json({ message: "Failed to request access." });
  }
};