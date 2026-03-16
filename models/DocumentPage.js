const mongoose = require('mongoose');

const documentPageSchema = new mongoose.Schema({
  // 1. Link to the main Document model
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  // 2. Page number to arrange the order during PDF generation
  pageNo: {
    type: Number,
    required: true
  },
  // 3. Page content
  content: {
    type: String,
    required: true
  }
}, { 
  // 4. Automatically adds createdAt and updatedAt
  timestamps: true 
});

// Optimization: Ensure a document can't have duplicate page numbers
documentPageSchema.index({ documentId: 1, pageNo: 1 }, { unique: true });

module.exports = mongoose.model('DocumentPage', documentPageSchema);