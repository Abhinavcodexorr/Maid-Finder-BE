const mongoose = require('mongoose');

const favouriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    maid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Maid',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

favouriteSchema.index({ user: 1, maid: 1 }, { unique: true });

module.exports = mongoose.model('Favourite', favouriteSchema);
