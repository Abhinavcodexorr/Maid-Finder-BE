const express = require('express');
const multer = require('multer');
const { uploadFile } = require('../controllers/uploadController');
const { optionalProtect } = require('../middleware/auth');
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

// Single generic upload endpoint — send the file under any field name
// (e.g. `file`, `image`, `video`, `photo`, `aadhaarFront`, `panCard`, etc.)
// and get back { success, url }.
router.post(
  '/',
  optionalProtect,
  upload.any(),
  uploadFile
);

module.exports = router;
