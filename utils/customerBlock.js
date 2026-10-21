const User = require('../models/User');

// A timed block ends by itself: once `blockedUntil` has passed the account is active again
// and the release is written to the account's history. Run before anything reads isActive.
const releaseExpiredBlock = async (user) => {
  if (!user || user.isActive || !user.blockedUntil || user.blockedUntil > new Date()) return user;
  user.isActive = true;
  user.blockedAt = undefined;
  user.blockReason = undefined;
  user.blockedUntil = undefined;
  user.moderationLog.push({ action: 'auto_unblocked', at: new Date() });
  await user.save();
  return user;
};

// Same, for the whole collection (used before listing).
const releaseAllExpiredBlocks = () =>
  User.updateMany(
    { isActive: false, blockedUntil: { $lte: new Date() } },
    {
      isActive: true,
      $unset: { blockedAt: 1, blockReason: 1, blockedUntil: 1 },
      $push: { moderationLog: { action: 'auto_unblocked', at: new Date() } },
    }
  );

module.exports = { releaseExpiredBlock, releaseAllExpiredBlocks };
