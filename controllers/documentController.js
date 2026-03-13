const Document = require('../models/Document');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const requestMail = require('../utils/requestMail');

// Helper to notify users (restored original notification logic)
async function notifySharedUsers(doc, ownerName) {
  try {
    const allSharedIds = [...(doc.readOnlyUsers || []), ...(doc.canEditUsers || [])];
    const users = await User.find({ _id: { $in: allSharedIds } }).select('email');
    const emailList = users.map(u => u.email);

    if (emailList.length > 0) {
      await requestMail({
        to: emailList,
        templateType: 'access_granted',
        data: {
          uploaderName: ownerName,
          documentTitle: doc.title,
          docId: doc._id
        }
      });
    }
  } catch (err) {
    console.error("🔴 EMAIL NOTIFICATION ERROR:", err);
  }
}

// ==========================================
// 1. Create a New Document (Handles Files)
// ==========================================
exports.createDocument = async (req, res) => {
  try {
    const { title, description, project, accessType, content, type, allowedUsers: usersInput } = req.body;
    
    let allowedUsers = [];
    if (usersInput) {
      allowedUsers = typeof usersInput === 'string' ? JSON.parse(usersInput) : usersInput;
    }

    // ⭐ Separate IDs for the new schema arrays
    const readOnlyUsers = allowedUsers.filter(u => !u.canEdit).map(u => u.userId);
    const canEditUsers = allowedUsers.filter(u => u.canEdit).map(u => u.userId);

    if (type !== 'text' && !req.file) {
      return res.status(400).json({ message: "A document file is required." });
    }

    const uploaderId = req.user?._id || req.user?.id;
    if (!uploaderId) return res.status(401).json({ message: "User authentication required." });

    const docData = {
      title: title || 'Untitled',
      description,
      project,
      accessType: accessType || 'public',
      readOnlyUsers,
      canEditUsers,
      uploadedBy: uploaderId,
      type: type || 'file', 
      content: content || '', 
    };

    if (req.file) {
      docData.fileUrl = `uploads/documents/${req.file.filename}`;
      docData.originalName = req.file.originalname;
      docData.fileType = req.file.originalname.split('.').pop().toUpperCase();
    } else {
      docData.fileType = 'TEXT'; 
    }

    const newDoc = new Document(docData);
    await newDoc.save();

    if (readOnlyUsers.length > 0 || canEditUsers.length > 0) {
      await notifySharedUsers(newDoc, req.user.name);
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
      .populate('readOnlyUsers', 'name email')
      .populate('canEditUsers', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json(documents);
  } catch (error) {
    console.error("🔴 GET DOCS ERROR:", error);
    res.status(500).json({ message: "Failed to retrieve documents." });
  }
};

// ==========================================
// 3. Request Access
// ==========================================
exports.requestAccess = async (req, res) => {
  try {
    const docId = req.params.id;
    const userId = req.user?._id;
    const userName = req.user?.name || "A team member";
    const message = req.body.message || "I need access to contribute to this document.";

    const document = await Document.findById(docId).populate('uploadedBy', 'name email');
    if (!document) return res.status(404).json({ message: "Document not found." });

    const existingRequest = document.accessRequests.find(r => r.userId?.toString() === userId?.toString());
    
    if (!existingRequest) {
      document.accessRequests.push({ userId, userName, message });
      await document.save();
      
      const newRequest = document.accessRequests[document.accessRequests.length - 1];

      if (document.uploadedBy?.email) {
        requestMail({
          to: document.uploadedBy.email,
          templateType: 'access_requested',
          data: {
            userName: userName,
            documentTitle: document.title,
            docId: docId,
            requestId: newRequest._id
          }
        });
      }
    }
    res.status(200).json({ message: "Access request sent successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to request access." });
  }
};

// ==========================================
// 4. Get Request Details (For Popup)
// ==========================================
exports.getRequestDetails = async (req, res) => {
  try {
    const { requestId } = req.params;
    const doc = await Document.findOne({ "accessRequests._id": requestId });
    if (!doc) return res.status(404).json({ message: "Request not found." });

    const request = doc.accessRequests.id(requestId);
    res.status(200).json({
      userName: request.userName,
      message: request.message,
      documentTitle: doc.title
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching request details." });
  }
};

// ==========================================
// 5. Grant Access (Moves to readOnlyUsers)
// ==========================================
exports.grantAccess = async (req, res) => {
  try {
    const { requestId } = req.params;
    const document = await Document.findOne({ "accessRequests._id": requestId });
    if (!document) return res.status(404).json({ message: "Request no longer exists." });

    const request = document.accessRequests.id(requestId);
    const targetUserId = request.userId;

    document.accessRequests.pull(requestId);

    // ⭐ Logic: Add to readOnlyUsers if not already present anywhere
    const isAlreadyMember = document.readOnlyUsers.includes(targetUserId) || document.canEditUsers.includes(targetUserId);
    if (!isAlreadyMember) {
      document.readOnlyUsers.push(targetUserId);
    }

    await document.save();

    const approvedUser = await User.findById(targetUserId);
    if (approvedUser?.email) {
      requestMail({
        to: approvedUser.email,
        templateType: 'access_granted',
        data: {
          uploaderName: req.user?.name || "The document owner",
          documentTitle: document.title,
          docId: document._id
        }
      });
    }

    res.status(200).json({ message: "Access granted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to process access grant." });
  }
};

// ==========================================
// 6. Decline Access Request
// ==========================================
exports.declineAccess = async (req, res) => {
  try {
    const { requestId } = req.params;
    const document = await Document.findOneAndUpdate(
      { "accessRequests._id": requestId },
      { $pull: { accessRequests: { _id: requestId } } },
      { new: true }
    );
    if (!document) return res.status(404).json({ message: "Request not found." });
    res.status(200).json({ message: "Request discarded successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to discard request." });
  }
};

// ==========================================
// 7. Standard CRUD
// ==========================================
exports.getDocumentById = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('uploadedBy', 'name email')
      .populate('readOnlyUsers', 'name email')
      .populate('canEditUsers', 'name email');
      
    if (!doc) return res.status(404).json({ message: "Document not found." });
    res.status(200).json(doc);
  } catch (error) {
    res.status(500).json({ message: "Error fetching document." });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const deletedDoc = await Document.findByIdAndDelete(req.params.id);
    if (!deletedDoc) return res.status(404).json({ message: "Document not found." });
    
    if (deletedDoc.fileUrl) {
      const filePath = path.join(__dirname, '..', deletedDoc.fileUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    
    res.status(200).json({ message: "Document deleted." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete document." });
  }
};

// ==========================================
// 8. Save/Autosave Text Document (Fixed logic)
// ==========================================
exports.saveTextDocument = async (req, res) => {
  try {
    const { title, project, accessType, content, allowedUsers: usersInput, documentId } = req.body;
    if (!req.user?._id) return res.status(401).json({ message: "Auth required" });

    let allowedUsers = [];
    if (usersInput) {
      allowedUsers = typeof usersInput === 'string' ? JSON.parse(usersInput) : usersInput;
    }

    const readOnlyUsers = allowedUsers.filter(u => !u.canEdit).map(u => u.userId);
    const canEditUsers = allowedUsers.filter(u => u.canEdit).map(u => u.userId);

    // ⭐ CASE 1: If documentId is present, we are UPDATING
    if (documentId) {
      const doc = await Document.findById(documentId);
      if (doc) {
        // Dirty check: Skip if content hasn't actually changed
        if (doc.content === content && doc.title === (title || doc.title)) {
          return res.status(200).json(doc);
        }

        doc.title = title || doc.title;
        doc.content = content;
        doc.readOnlyUsers = readOnlyUsers;
        doc.canEditUsers = canEditUsers;
        doc.lastSavedAt = Date.now();

        await doc.save();
        return res.status(200).json(doc); 
      }
    }

    // ⭐ CASE 2: Only create a NEW document if no ID was provided
    const newDoc = new Document({
      title: title || 'Untitled',
      project,
      accessType: accessType || 'restricted',
      type: 'text',
      content: content || '',
      readOnlyUsers,
      canEditUsers,
      uploadedBy: req.user._id,
      fileType: 'HTML'
    });

    await newDoc.save();
    if (readOnlyUsers.length > 0 || canEditUsers.length > 0) {
        await notifySharedUsers(newDoc, req.user.name);
    }
    
    res.status(201).json(newDoc);
  } catch (error) {
    console.error("🔴 SAVE TEXT DOC ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// 9. Update Document (Handles Files & Text)
// ==========================================
exports.updateDocument = async (req, res) => {
  try {
    const { title, description, accessType, content, type, allowedUsers: usersInput } = req.body;
    
    let allowedUsers = [];
    if (usersInput) {
      allowedUsers = typeof usersInput === 'string' ? JSON.parse(usersInput) : usersInput;
    }

    const oldDoc = await Document.findById(req.params.id);
    if (!oldDoc) return res.status(404).json({ message: "Document not found." });

    const readOnlyUsers = allowedUsers.length > 0 ? allowedUsers.filter(u => !u.canEdit).map(u => u.userId) : oldDoc.readOnlyUsers;
    const canEditUsers = allowedUsers.length > 0 ? allowedUsers.filter(u => u.canEdit).map(u => u.userId) : oldDoc.canEditUsers;

    const updateData = { 
      title, 
      description, 
      accessType, 
      readOnlyUsers,
      canEditUsers,
      content,
      type: type || oldDoc.type,
      lastSavedAt: Date.now()
    };

    if (req.file) {
      if (oldDoc.fileUrl) {
        const oldPath = path.join(__dirname, '..', oldDoc.fileUrl);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updateData.fileUrl = `uploads/documents/${req.file.filename}`;
      updateData.originalName = req.file.originalname;
      updateData.fileType = req.file.originalname.split('.').pop().toUpperCase();
    }

    const updatedDoc = await Document.findByIdAndUpdate(
      req.params.id, 
      { $set: updateData }, 
      { new: true }
    ).populate('uploadedBy', 'name email').populate('readOnlyUsers', 'name email').populate('canEditUsers', 'name email');

    res.status(200).json(updatedDoc);
  } catch (error) {
    console.error("🔴 UPDATE DOC ERROR:", error);
    res.status(500).json({ message: "Failed to update document." });
  }
};