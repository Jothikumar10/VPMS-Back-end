const mongoose = require('mongoose');

const STATUS = [
  'pending',
  'approved',
  'rejected',
  'checked-in',
  'checked-out',
  'cancelled',
];

const visitRequestSchema = new mongoose.Schema(
  {
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    purpose: { type: String, required: true, trim: true },
    visitDate: { type: Date, required: true }, // date only (midnight)
    expectedArrivalTime: { type: String, required: true }, // "HH:mm" 24h
    status: { type: String, enum: STATUS, default: 'pending' },

    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    badgeNumber: { type: String, default: null },

    employeeRemarks: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    cancellationReason: { type: String, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    checkedOutBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

visitRequestSchema.index({ visitor: 1, visitDate: 1 });
visitRequestSchema.index({ employee: 1, status: 1 });
visitRequestSchema.index({ status: 1, visitDate: 1 });

visitRequestSchema.statics.STATUS = STATUS;
visitRequestSchema.statics.ACTIVE_STATUSES = ['pending', 'approved', 'checked-in'];

module.exports = mongoose.model('VisitRequest', visitRequestSchema);
