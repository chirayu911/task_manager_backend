const AuditLog = require('../models/AuditLog');

/**
 * Creates an Audit Log entry.
 * @param {Object} req - Express request object to extract IP.
 * @param {Object} data - Audit log metadata.
 * @param {String} data.user - User ID performing the action.
 * @param {String} data.company - Company ID context.
 * @param {String} data.action - Action enum (e.g., 'UPDATED', 'LOGIN').
 * @param {String} data.resourceType - Resource Type enum (e.g., 'Task').
 * @param {String} [data.resourceId] - Resource ID.
 * @param {Object} [data.beforeState] - Previous state of the resource.
 * @param {Object} [data.afterState] - New state of the resource.
 * @param {String} [data.description] - Human-readable description.
 */
const logAudit = async (req, data) => {
  try {
    // Extract IP dynamically, prioritizing x-forwarded-for if behind proxies
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'Unknown';

    const resolvedUser = data.user || req.user;
    const resolvedCompany = data.company || req.user?.company;

    await AuditLog.create({
      user: resolvedUser?._id || resolvedUser?.id || resolvedUser,
      company: resolvedCompany?._id || resolvedCompany?.id || resolvedCompany,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      ipAddress: ipAddress,
      beforeState: data.beforeState,
      afterState: data.afterState,
      description: data.description,
    });
  } catch (error) {
    console.error('🔴 AUDIT LOG ERROR:', error);
  }
};

module.exports = logAudit;
