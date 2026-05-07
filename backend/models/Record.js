const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  usn: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  year: {
    type: String,
    required: true
  },
  dept: {
    type: String,
    required: true
  },
  marks: {
    type: String,
    required: true
  },
  program: {
    type: String,
    required: true
  },
  pdfFile: {
    type: Buffer,
    default: null
  },
  pdfFileName: {
    type: String,
    default: null
  },
  cid: {
    type: String,
    default: null,
    index: true
  },
  ipfsUrl: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'VERIFIED', 'APPROVED_ON_CHAIN', 'NEEDS_EDIT'],
    default: 'DRAFT',
    index: true
  },
  uploader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verifier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approverWallet: {
    type: String,
    default: null
  },
  txHash: {
    type: String,
    default: null,
    index: true
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  editNotes: {
    type: String,
    default: null
  },
  metadata: {
    type: Map,
    of: String,
    default: {}
  }
}, {
  timestamps: true
});

// Index for efficient queries
recordSchema.index({ status: 1, createdAt: -1 });
recordSchema.index({ usn: 1, status: 1 });
recordSchema.index({ uploader: 1, status: 1 });
recordSchema.index({ verifier: 1, status: 1 });

// Prevent editing after APPROVED_ON_CHAIN
recordSchema.pre('save', function(next) {
  // Allow transition to APPROVED_ON_CHAIN (first time setting it)
  if (this.isModified('status') && this.status === 'APPROVED_ON_CHAIN') {
    return next(); // Allow this save
  }
  
  // Block further edits after already APPROVED_ON_CHAIN
  if (this.isModified() && !this.isNew && this.status === 'APPROVED_ON_CHAIN') {
    // Only allow updates to specific fields for on-chain records
    const allowedFields = ['status', 'txHash', 'approvedAt', 'approver', 'approverWallet', 'updatedAt', 'cid', 'ipfsUrl'];
    const modifiedPaths = this.modifiedPaths();
    const hasDisallowedChanges = modifiedPaths.some(path => !allowedFields.includes(path));
    
    if (hasDisallowedChanges) {
      return next(new Error('Cannot edit record after it has been approved and added to blockchain'));
    }
  }
  next();
});

module.exports = mongoose.model('Record', recordSchema);






