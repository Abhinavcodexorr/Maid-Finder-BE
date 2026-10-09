const mongoose = require('mongoose');

const favouriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Field key stays `maid` (not renamed to `provider`) so existing
    // favourite documents in the live DB aren't orphaned — only the model
    // it references changed, since the Maid model is now named Provider.
    maid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

favouriteSchema.index({ user: 1, maid: 1 }, { unique: true });

module.exports = mongoose.model('Favourite', favouriteSchema);
