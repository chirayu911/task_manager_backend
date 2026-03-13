const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  ownerName: { type: String, required: true },
  ownerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }, // Links the company to the user who created it
  streetAddress: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true },
  companyEmail: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  nominalCapital: { type: String },
  industry: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);