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
const VIDEO_MIMETYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/3gpp'];

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
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video') {
      if (!VIDEO_MIMETYPES.includes(file.mimetype)) {
        const error = new Error(MESSAGES.provider.videoInvalidType);
        error.statusCode = 400;
        return cb(error, false);
      }
      return cb(null, true);
    }
    return photoAndIdFilter(req, file, cb);
  },
});

router.get('/list', listProviders);
router.get('/me', protectProvider, getMe);
router.put('/me', protectProvider, updateMyProfile);

// Profile completion (requires the provider's own login token): submits
// General info + Work preferences + Last job from the 4-step form in one
// call. See completeProfile in the controller for the body shape.
router.post(
  '/me/complete-profile',
  protectProvider,
  completeProfileUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'idDocuments', maxCount: 10 },
    // Legacy single-file name, kept for clients still sending one ID
    // document under the old field name instead of the new plural one.
    { name: 'idDocument', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
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
