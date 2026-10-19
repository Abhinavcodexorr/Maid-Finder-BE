// Backfill: make a thumbnail (and a web-friendly copy) for intro videos uploaded before
// this existed. Needs ffmpeg and the same .env as the server.
//   node scripts/processVideos.js           -> thumbnails + web copies
//   node scripts/processVideos.js --thumbs  -> thumbnails only (fast)
require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const { makeThumbnail, makeWebVideo } = require('../utils/videoProcess');

(async () => {
  const thumbsOnly = process.argv.includes('--thumbs');
  await mongoose.connect(process.env.MONGODB_URI);
  const providers = await Provider.find({
    introVideoUrl: { $exists: true, $ne: '' },
    $or: [{ introVideoThumbnailUrl: { $in: [null, ''] } }, ...(thumbsOnly ? [] : [{ introVideoOriginalUrl: { $in: [null, ''] } }])],
  }).select('fullName introVideoUrl introVideoThumbnailUrl introVideoOriginalUrl');
  console.log(`${providers.length} video(s) to process`);

  for (const p of providers) {
    try {
      const update = {};
      if (!p.introVideoThumbnailUrl) update.introVideoThumbnailUrl = await makeThumbnail(p.introVideoUrl);
      if (!thumbsOnly && !p.introVideoOriginalUrl) {
        update.introVideoOriginalUrl = p.introVideoUrl;
        update.introVideoUrl = await makeWebVideo(p.introVideoUrl);
      }
      await Provider.updateOne({ _id: p._id }, update);
      console.log('done  ', p.fullName || p._id);
    } catch (error) {
      console.log('failed', p.fullName || p._id, '-', error.message);
    }
  }
  await mongoose.disconnect();
})();
