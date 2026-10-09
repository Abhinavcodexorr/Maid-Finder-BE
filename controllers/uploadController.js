const { uploadBufferToS3 } = require('../utils/s3Upload');
const MESSAGES = require('../config/errorMessages.json');

exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: MESSAGES.upload.noFileProvided });
    }
    const url = await uploadBufferToS3(req.file.buffer, req.file.mimetype, 'help-zone/uploads');
    res.json({ success: true, url });
  } catch (error) {
    next(error);
  }
};
