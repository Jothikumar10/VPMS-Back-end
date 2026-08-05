const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    company: { type: String, trim: true },
    idProofType: {
      type: String,
      enum: ['Aadhaar', 'PAN', 'Passport', 'Driving License', 'Voter ID', 'Other'],
      default: 'Other',
    },
    idProofNumber: { type: String, trim: true },
    photoUrl: { type: String, trim: true },
  },
  { timestamps: true }
);

// A visitor is uniquely identified by phone number for duplicate/active-visit checks
visitorSchema.index({ phone: 1 });

module.exports = mongoose.model('Visitor', visitorSchema);
