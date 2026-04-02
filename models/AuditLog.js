const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
  },
  action: {
    type: String,
    required: true,
    enum: ['LOGIN', 'LOGOUT', 'CREATED', 'UPDATED', 'DELETED', 'UPGRADED', 'COMPANY_REGISTERED'],
  },
  resourceType: {
    type: String,
    enum: ['Task', 'Issue', 'Project', 'Document', 'DocumentPage', 'User', 'Company', 'Subscription', 'Auth'],
    required: true,
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  ipAddress: {
    type: String,
  },
  beforeState: {
    type: mongoose.Schema.Types.Mixed,
  },
  afterState: {
    type: mongoose.Schema.Types.Mixed,
  },
  description: {
    type: String,
  },
}, { timestamps: true });

// Index for faster queries
auditLogSchema.index({ company: 1, createdAt: -1 });
auditLogSchema.index({ user: 1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
