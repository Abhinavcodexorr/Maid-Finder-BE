const express = require('express');
const multer = require('multer');
const { uploadImage } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, jpg, png, gif, webp) are allowed'), false);
    }
  },
});

router.post('/', protect, upload.single('image'), uploadImage);

module.exports = router;
