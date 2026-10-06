const { uploadBufferToS3 } = require('../utils/s3Upload');

exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }
    const url = await uploadBufferToS3(req.file.buffer, req.file.mimetype, 'maid-finder/uploads');
    res.json({ success: true, url });
  } catch (error) {
    next(error);
  }
};
