const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    visitRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'VisitRequest', required: true },
    action: {
      type: String,
      enum: ['Created', 'Approved', 'Rejected', 'Checked In', 'Checked Out', 'Cancelled'],
      required: true,
    },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    remarks: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

activityLogSchema.index({ visitRequest: 1, timestamp: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
