const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
    name: { type: String, required: true, trim: true },
    currencyCode: { type: String, required: true, uppercase: true, trim: true },
    currencySymbol: { type: String, required: true, trim: true },
    dialCode: { type: String, trim: true },
    timezone: { type: String, trim: true },
    locale: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Country', countrySchema, 'countries');
