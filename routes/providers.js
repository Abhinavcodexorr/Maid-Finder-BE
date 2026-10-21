const express = require('express');
const multer = require('multer');
const {
  sendOtp,
  verifyOtp,
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
const { IMAGE_MIMETYPES, ID_DOCUMENT_MIMETYPES, isVideoMimetype } = require('../config/mimeTypes');

const router = express.Router();

const photoAndIdFilter = (req, file, cb) => {
  if (
    file.fieldname === 'photo' ||
    file.fieldname === 'image' ||
    file.fieldname === 'file' ||
    file.fieldname === 'profilePhoto' ||
    file.fieldname === 'avatar'
  ) {
    if (!IMAGE_MIMETYPES.includes(file.mimetype)) {
      const error = new Error(MESSAGES.provider.photoInvalidType);
      error.statusCode = 400;
      return cb(error, false);
    }
    return cb(null, true);
  }
  if (
    file.fieldname === 'idDocument' ||
    file.fieldname === 'idDocuments' ||
    file.fieldname === 'aadhaarFront' ||
    file.fieldname === 'aadhaarBack' ||
    file.fieldname === 'panCard' ||
    file.fieldname === 'pan' ||
    file.fieldname === 'document' ||
    file.fieldname === 'doc'
  ) {
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
    if (file.fieldname === 'video' || file.fieldname === 'introVideo') {
      // application/octet-stream allowed here (but not via isVideoMimetype's
      // default) since some Android camera apps report that generic type
      // for a recorded video specifically on this field.
      const isVideo = isVideoMimetype(file.mimetype) || file.mimetype === 'application/octet-stream';
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
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'avatar', maxCount: 1 },
    { name: 'idDocuments', maxCount: 10 },
    { name: 'idDocument', maxCount: 1 },
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
    { name: 'pan', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'introVideo', maxCount: 1 },
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

// Step 1 — Mobile Verification: send-otp -> verify-otp. verifyOtp
// find-or-creates the account, so it serves both first-time signup and
// returning-provider login.
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

router.get('/list', listProviders);
router.get('/me', protectProvider, getMe);
router.put('/me', protectProvider, updateMyProfile);

// Profile completion: submits General info + Work preferences + Last job + KYC.
// Supports both /me/complete-profile and /complete-register aliases (both POST and PUT).
router.post(
  '/me/complete-profile',
  protectProvider,
  handleCompleteProfileUpload,
  completeProfile
);
router.post(
  '/complete-profile',
  protectProvider,
  handleCompleteProfileUpload,
  completeProfile
);
router.post(
  '/me/complete-register',
  protectProvider,
  handleCompleteProfileUpload,
  completeProfile
);
router.post(
  '/complete-register',
  protectProvider,
  handleCompleteProfileUpload,
  completeProfile
);
router.put(
  '/me/complete-profile',
  protectProvider,
  handleCompleteProfileUpload,
  completeProfile
);
router.put(
  '/complete-profile',
  protectProvider,
  handleCompleteProfileUpload,
  completeProfile
);
router.put(
  '/me/complete-register',
  protectProvider,
  handleCompleteProfileUpload,
  completeProfile
);
router.put(
  '/complete-register',
  protectProvider,
  handleCompleteProfileUpload,
  completeProfile
);

router.get('/:id', getProviderById);
router.post(
  '/register',
  registerUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'idDocument', maxCount: 1 },
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
  ]),
  register
);
router.post('/login', login);
router.put('/:id', protectProvider, updateProvider);

module.exports = router;
