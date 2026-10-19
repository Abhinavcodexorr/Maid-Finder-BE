const mongoose = require('mongoose');
const { SERVICE_ICONS } = require('../config/constants');

// Catalog of service categories an admin manages. Providers reference a
// service by its `key` (e.g. "cat-cook") in Provider.categoryIds, which is why
// the key is immutable: renaming a service must never orphan its providers.
const serviceSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Service key is required'],
      trim: true,
      lowercase: true,
      immutable: true,
      match: [/^cat-[a-z0-9]+(-[a-z0-9]+)*$/, 'Service key must look like cat-cook'],
    },
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      minlength: [2, 'Service name must be at least 2 characters'],
      maxlength: [60, 'Service name cannot exceed 60 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: '',
    },
    icon: {
      type: String,
      enum: { values: ['', ...SERVICE_ICONS], message: 'Unknown icon: {VALUE}' },
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Optional second level, e.g. "AC Servicing" -> Window AC, Split AC. Providers
    // reference one by `key` in Provider.subCategoryIds, so a key never changes once made.
    subCategories: {
      type: [
        new mongoose.Schema(
          {
            key: { type: String, required: true, trim: true, lowercase: true },
            name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
            isActive: { type: Boolean, default: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

serviceSchema.index({ key: 1 }, { unique: true });
// Names are unique ignoring case ("Cook" and "cook" are the same service).
serviceSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
serviceSchema.index({ isActive: 1 });

module.exports = mongoose.model('Service', serviceSchema, 'services');
