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
  updateGeneralInfo,
  updateWorkPreferences,
  updateLastJob,
  submitProfile,
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

// Profile-completion wizard (all require the provider's own login token):
// Step 1/4 — General info: age, marital status, PAN, profile photo and/or
// ID document re-upload (both files optional — only sent if changed).
router.patch(
  '/me/general-info',
  protectProvider,
  registerUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'idDocument', maxCount: 1 },
  ]),
  updateGeneralInfo
);
// Step 2/4 — Work preferences: experience, expected salary, preferred
// service, work duration, languages, skills, education.
router.patch('/me/work-preferences', protectProvider, updateWorkPreferences);
// Step 3/4 — Last job: most recent work experience details.
router.patch('/me/last-job', protectProvider, updateLastJob);
// Step 4/4 — Review & submit: marks the profile complete and (re)submits
// it for admin review.
router.post('/me/submit', protectProvider, submitProfile);

// One-shot alternative to the 4 steps above, for a frontend that collects
// everything itself and submits once. See completeProfile for the body shape.
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
