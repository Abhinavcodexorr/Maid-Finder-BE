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

const registerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'photo') {
      if (!IMAGE_MIMETYPES.includes(file.mimetype)) {
        const error = new Error(MESSAGES.provider.photoInvalidType);
        error.statusCode = 400;
        return cb(error, false);
      }
      return cb(null, true);
    }
    if (file.fieldname === 'idDocument') {
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
  registerUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'idDocument', maxCount: 1 },
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
