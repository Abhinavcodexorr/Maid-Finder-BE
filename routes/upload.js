const express = require('express');
const multer = require('multer');
const { uploadFile } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const MESSAGES = require('../config/errorMessages.json');
const { IMAGE_MIMETYPES, isVideoMimetype } = require('../config/mimeTypes');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  // No size cap — this accepts both images and videos through the same
  // field, and a video-appropriate limit would be pointless on an image.
  fileFilter: (req, file, cb) => {
    const isImage = IMAGE_MIMETYPES.includes(file.mimetype);
    const isVideo = isVideoMimetype(file.mimetype) || file.mimetype === 'application/octet-stream';
    if (isImage || isVideo) return cb(null, true);
    const error = new Error(MESSAGES.upload.invalidFileType);
    error.statusCode = 400;
    cb(error, false);
  },
});

// Single generic upload endpoint — send the file under any of these field
// names (whichever is convenient client-side), get back { success, url }.
// Accepts both images (jpeg/jpg/png/webp/gif) and videos (mp4/mov/webm/...).
router.post(
  '/',
  protect,
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  uploadFile
);

module.exports = router;
