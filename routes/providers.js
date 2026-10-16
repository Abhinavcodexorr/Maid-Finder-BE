const express = require('express');
const multer = require('multer');
const {
  register,
  login,
  getMe,
  listProviders,
  getProviderById,
  updateProvider,
  updateMyProfile,
  completeProfile,
} = require('../controllers/providerController');
const { protectProvider } = require('../middleware/auth');
const MESSAGES = require('../config/errorMessages.json');
const formatMessage = require('../utils/formatMessage');

const router = express.Router();

const IMAGE_MIMETYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ID_DOCUMENT_MIMETYPES = [...IMAGE_MIMETYPES, 'application/pdf'];
const VIDEO_MIMETYPES = [
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
  'video/3gpp', 'video/3gpp2', 'video/avi', 'video/x-msvideo',
  'video/mpeg', 'video/ogg', 'video/x-flv', 'video/x-ms-wmv',
  'application/octet-stream', // some Android devices send raw bytes
];

const photoAndIdFilter = (req, file, cb) => {
  if (file.fieldname === 'photo') {
    if (!IMAGE_MIMETYPES.includes(file.mimetype)) {
      const error = new Error(MESSAGES.provider.photoInvalidType);
      error.statusCode = 400;
      return cb(error, false);
    }
    return cb(null, true);
  }
  if (file.fieldname === 'idDocument' || file.fieldname === 'idDocuments') {
    if (!ID_DOCUMENT_MIMETYPES.includes(file.mimetype)) {
      const error = new Error(MESSAGES.provider.idDocumentInvalidType);
      error.statusCode = 400;
      return cb(error, false);
    }
    return cb(null, true);
  }
  const error = new Error(formatMessage(MESSAGES.provider.unexpectedFileField, { field: file.fieldname }));
  error.statusCode = 400;
  cb(error, false);
};

const registerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: photoAndIdFilter,
});

// Same photo/idDocument rules as registerUpload, plus an optional intro
// video — given its own, much larger size limit (videos are expected to
// run from 1 to 5 minutes per the product's walkthrough).
const completeProfileUpload = multer({
  storage: multer.memoryStorage(),
  // No file-size limit — mobile intro videos can be large.
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video') {
      // Accept any video-ish mimetype; also allow octet-stream since some
      // Android/iOS camera apps report a generic binary type.
      const isVideo = VIDEO_MIMETYPES.includes(file.mimetype) ||
        file.mimetype.startsWith('video/');
      if (!isVideo) {
        const error = new Error(MESSAGES.provider.videoInvalidType);
        error.statusCode = 400;
        return cb(error, false);
      }
      return cb(null, true);
    }
    return photoAndIdFilter(req, file, cb);
  },
});

// Inline middleware that catches Multer errors (e.g. LIMIT_FILE_SIZE) and
// returns a clean JSON response instead of letting the raw error bubble up.
const handleCompleteProfileUpload = (req, res, next) => {
  completeProfileUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'idDocuments', maxCount: 10 },
    { name: 'idDocument', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      const status = err.statusCode || 400;
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? MESSAGES.upload.fileTooLarge
          : err.message || 'File upload error';
      return res.status(status).json({ success: false, message });
    }
    next();
  });
};

router.get('/list', listProviders);
router.get('/me', protectProvider, getMe);
router.put('/me', protectProvider, updateMyProfile);

// Profile completion (requires the provider's own login token): submits
// General info + Work preferences + Last job from the 4-step form in one
// call. See completeProfile in the controller for the body shape.
router.post(
  '/me/complete-profile',
  protectProvider,
  handleCompleteProfileUpload,
  completeProfile
);

router.get('/:id', getProviderById);
router.post(
  '/register',
  registerUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'idDocument', maxCount: 1 },
  ]),
  register
);
router.post('/login', login);
router.put('/:id', protectProvider, updateProvider);

module.exports = router;
