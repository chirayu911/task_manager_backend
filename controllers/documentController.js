const Document = require('../models/Document');
const User = require('../models/User');
const DocumentPage = require('../models/DocumentPage');
const Company = require('../models/Company');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const requestMail = require('../utils/requestMail');
const { buildCompanyPDF } = require('../utils/pdfGenerator');
const logActivity = require('../utils/logActivity'); // ⭐ Imported the activity logger
const logAudit = require('../utils/auditLogger');
const puppeteer = require('puppeteer');

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

    const readOnlyUsers = allowedUsers.filter(u => !u.canEdit).map(u => u.userId);
    const canEditUsers = allowedUsers.filter(u => u.canEdit).map(u => u.userId);

    if (type !== 'text' && !req.file) {
      return res.status(400).json({ message: "A document file is required." });
    }

    const uploaderId = req.user?._id || req.user?.id;
    if (!uploaderId) return res.status(401).json({ message: "User authentication required." });

    const userCompanyId = req.user?.company;

    // ⭐ SUBSCRIPTION LIMIT CHECK
    if (userCompanyId) {
      const company = await Company.findById(userCompanyId).populate('subscriptionPlan');
      if (company) {
        const maxDocuments = company.subscriptionPlan ? company.subscriptionPlan.maxDocuments : 10;
        if (maxDocuments !== -1) {
          const currentDocCount = await Document.countDocuments({ company: userCompanyId });
          if (currentDocCount >= maxDocuments) {
            return res.status(403).json({
              message: company.subscriptionPlan
                ? `Subscription Limit Exceeded: Your plan allows a maximum of ${maxDocuments} documents. Please upgrade your plan.`
                : `Subscription Limit Exceeded: You do not have an active plan. Default limit is 10 documents. Please subscribe.`
            });
          }
        }
      }
    }

    const docData = {
      title: title || 'Untitled',
      description,
      project,
      company: userCompanyId,
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

    // ⭐ ACTIVITY LOG: Document Upload/Creation
    await logActivity({
      user: req.user._id,
      company: userCompanyId,
      project: project,
      action: req.file ? 'uploaded' : 'created',
      resourceType: 'document',
      resourceId: newDoc._id,
      description: `${req.file ? 'Uploaded' : 'Created'} document: "${newDoc.title}"`
    });

    await logAudit(req, {
      user: req.user._id,
      company: userCompanyId,
      action: 'CREATED',
      resourceType: 'Document',
      resourceId: newDoc._id,
      afterState: newDoc.toObject ? newDoc.toObject() : newDoc,
      description: `${req.file ? 'Uploaded' : 'Created'} document: "${newDoc.title}"`
    });

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
// 7. Standard CRUD (Updated to include DocumentPages)
// ==========================================
exports.getDocumentById = async (req, res) => {
  try {
    // 1. Find the main document metadata
    const doc = await Document.findById(req.params.id)
      .populate('uploadedBy', 'name email')
      .populate('readOnlyUsers', 'name email')
      .populate('canEditUsers', 'name email')
      .lean();

    if (!doc) return res.status(404).json({ message: "Document not found." });

    // 2. Fetch the individual pages from the DocumentPage collection
    const pageRecords = await DocumentPage.find({ documentId: doc._id })
      .sort({ pageNo: 1 }) // Crucial: ensures Page 1 comes before Page 2

    // 3. Format pages specifically for the React State
    // We transform the array of objects into a simple array of HTML strings
    if (pageRecords && pageRecords.length > 0) {
      doc.pages = pageRecords.map(p => p.content || "");

      // Fallback: If for some reason the first page is empty but doc.content has data
      if (doc.pages.length === 1 && !doc.pages[0] && doc.content) {
        doc.pages = [doc.content];
      }
    } else {
      // 4. Fallback for legacy documents that don't have entries in DocumentPage yet
      // This ensures the editor doesn't open to a blank screen for old docs
      doc.pages = doc.content ? [doc.content] : [''];
    }

    // Keep the single content string for search results or simple previews if needed
    doc.content = doc.pages.join('');

    res.status(200).json(doc);
  } catch (error) {
    console.error("🔴 GET DOC BY ID ERROR:", error);
    res.status(500).json({ message: "Error fetching document pages." });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const deletedDoc = await Document.findByIdAndDelete(req.params.id);
    if (!deletedDoc) return res.status(404).json({ message: "Document not found." });

    // ⭐ ACTIVITY LOG: Document Deletion
    await logActivity({
      user: req.user._id,
      company: req.user.company,
      project: deletedDoc.project,
      action: 'deleted',
      resourceType: 'document',
      resourceId: deletedDoc._id,
      description: `Deleted document: "${deletedDoc.title}"`
    });

    await logAudit(req, {
      user: req.user._id,
      company: req.user.company,
      action: 'DELETED',
      resourceType: 'Document',
      resourceId: deletedDoc._id,
      beforeState: deletedDoc.toObject ? deletedDoc.toObject() : deletedDoc,
      description: `Deleted document: "${deletedDoc.title}"`
    });

    if (deletedDoc.fileUrl) {
      const filePath = path.join(__dirname, '..', deletedDoc.fileUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await DocumentPage.deleteMany({ documentId: deletedDoc._id });

    res.status(200).json({ message: "Document deleted." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete document." });
  }
};

// ==========================================
// 8. Save/Autosave Text Document (Updated for Modular Pages)
// ==========================================
exports.saveTextDocument = async (req, res) => {
  try {
    const {
      title, project, accessType, content, pages,
      allowedUsers: usersInput, documentId, fileExtension
    } = req.body;

    if (!req.user?._id) return res.status(401).json({ message: "Auth required" });

    let allowedUsers = [];
    if (usersInput) {
      allowedUsers = typeof usersInput === 'string' ? JSON.parse(usersInput) : usersInput;
    }

    const readOnlyUsers = allowedUsers.filter(u => !u.canEdit).map(u => u.userId);
    const canEditUsers = allowedUsers.filter(u => u.canEdit).map(u => u.userId);
    const targetFileType = fileExtension?.toUpperCase() === 'DOC' ? 'DOC' : 'TXT';
    const userCompanyId = req.user?.company;

    let doc;

    // --- CASE A: UPDATE EXISTING DOCUMENT ---
    if (documentId) {
      doc = await Document.findById(documentId);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const oldDocState = doc.toObject ? doc.toObject() : doc;

      // Update Parent Document Metadata
      doc.title = title || doc.title;
      // We store the content of the first page in the main doc for search/previews
      doc.content = (Array.isArray(pages) && pages.length > 0) ? pages[0] : (content || "");
      doc.readOnlyUsers = readOnlyUsers;
      doc.canEditUsers = canEditUsers;
      doc.lastSavedAt = Date.now();
      doc.fileType = targetFileType;

      await doc.save();

      // ⭐ MODULAR PAGE LOGIC: Sync DocumentPage Collection
      if (targetFileType === 'DOC' && Array.isArray(pages)) {
        // 1. Remove old pages for this document to ensure a clean sync
        await DocumentPage.deleteMany({ documentId: doc._id });

        // 2. Map the array of strings/objects from frontend to the DocumentPage schema
        const pageEntries = pages.map((pageContent, index) => ({
          documentId: doc._id,
          pageNo: index + 1,
          content: pageContent || '', // Assuming frontend sends ['content1', 'content2']
          company: userCompanyId
        }));

        // 3. Batch insert the new page structure
        await DocumentPage.insertMany(pageEntries);
      }

      await logAudit(req, {
        user: req.user._id,
        company: userCompanyId,
        action: 'UPDATED',
        resourceType: 'Document',
        resourceId: doc._id,
        beforeState: oldDocState,
        afterState: doc.toObject ? doc.toObject() : doc,
        description: `Saved text document: "${doc.title}"`
      });

      return res.status(200).json(doc);
    }

    // --- CASE B: CREATE NEW DOCUMENT ---
    // (Subscription check omitted for brevity, keep your existing one here)

    const newDoc = new Document({
      title: title || 'Untitled',
      project,
      company: userCompanyId,
      accessType: accessType || 'restricted',
      type: 'text',
      content: (Array.isArray(pages) && pages.length > 0) ? pages[0] : (content || ''),
      readOnlyUsers,
      canEditUsers,
      uploadedBy: req.user._id,
      fileType: targetFileType
    });

    await newDoc.save();

    // ⭐ Create the initial pages in DocumentPage dataset
    if (targetFileType === 'DOC') {
      if (Array.isArray(pages) && pages.length > 0) {
        const pageEntries = pages.map((pageContent, index) => ({
          documentId: newDoc._id,
          pageNo: index + 1,
          content: pageContent || '',
          company: userCompanyId
        }));
        await DocumentPage.insertMany(pageEntries);
      } else {
        // Create at least one blank page if none provided
        await DocumentPage.create({
          documentId: newDoc._id,
          pageNo: 1,
          content: content || '',
          company: userCompanyId
        });
      }
    }

    await logAudit(req, {
      user: req.user._id,
      company: userCompanyId,
      action: 'CREATED',
      resourceType: 'Document',
      resourceId: newDoc._id,
      afterState: newDoc.toObject ? newDoc.toObject() : newDoc,
      description: `Created text document: "${newDoc.title}"`
    });

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

    // ⭐ ACTIVITY LOG: File/Settings Update
    await logActivity({
      user: req.user._id,
      company: req.user.company,
      project: updatedDoc.project,
      action: 'updated',
      resourceType: 'document',
      resourceId: updatedDoc._id,
      description: `Updated document settings/file for: "${updatedDoc.title}"`
    });

    await logAudit(req, {
      user: req.user._id,
      company: req.user.company,
      action: 'UPDATED',
      resourceType: 'Document',
      resourceId: updatedDoc._id,
      beforeState: oldDoc.toObject ? oldDoc.toObject() : oldDoc,
      afterState: updatedDoc.toObject ? updatedDoc.toObject() : updatedDoc,
      description: `Updated document settings/file for: "${updatedDoc.title}"`
    });

    res.status(200).json(updatedDoc);
  } catch (error) {
    console.error("🔴 UPDATE DOC ERROR:", error);
    res.status(500).json({ message: "Failed to update document." });
  }
};

// ==========================================
// 10. Generate PDF (.doc only) with Company Branding
// ==========================================
exports.generateDocumentPDF = async (req, res) => {
  try {
    const docData = await Document.findById(req.params.id).populate('uploadedBy');

    if (!docData || docData.fileType !== 'DOC') {
      return res.status(400).json({ message: 'PDF generation only supported for .doc files' });
    }

    let companyData = {
      companyName: "Organization Document",
      companyEmail: "",
      fullAddress: ""
    };

    if (req.user && req.user.company) {
      const company = await Company.findById(req.user.company);
      if (company) {
        companyData = company;
      }
    }

    const pages = await DocumentPage.find({ documentId: docData._id }).sort({ pageNo: 1 }).lean();;
    if (!pages || pages.length === 0) {
      return res.status(404).json({ message: "No content pages found for this document." });
    }

    buildCompanyPDF(res, docData, companyData, pages);

  } catch (error) {
    console.error("🔴 PDF GEN ERROR:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate PDF." });
    }
  }
};