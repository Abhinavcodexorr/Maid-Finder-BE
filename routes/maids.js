const express = require('express');
const multer = require('multer');
const { register, login, getMe, listMaids, getMaidById, updateMaid, updateMyProfile } = require('../controllers/maidController');
const { protectMaid } = require('../middleware/auth');

const router = express.Router();

const IMAGE_MIMETYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ID_DOCUMENT_MIMETYPES = [...IMAGE_MIMETYPES, 'application/pdf'];

const registerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'photo') {
      if (!IMAGE_MIMETYPES.includes(file.mimetype)) {
        const error = new Error('Photo must be an image (jpeg, jpg, png or webp)');
        error.statusCode = 400;
        return cb(error, false);
      }
      return cb(null, true);
    }
    if (file.fieldname === 'idDocument') {
      if (!ID_DOCUMENT_MIMETYPES.includes(file.mimetype)) {
        const error = new Error('ID document must be an image (jpeg, jpg, png, webp) or PDF');
        error.statusCode = 400;
        return cb(error, false);
      }
      return cb(null, true);
    }
    const error = new Error(`Unexpected file field: ${file.fieldname}`);
    error.statusCode = 400;
    cb(error, false);
  },
});

router.get('/list', listMaids);
router.get('/me', protectMaid, getMe);
router.put('/me', protectMaid, updateMyProfile);
router.get('/:id', getMaidById);
router.post(
  '/register',
  registerUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'idDocument', maxCount: 1 },
  ]),
  register
);
router.post('/login', login);
router.put('/:id', protectMaid, updateMaid);

module.exports = router;
