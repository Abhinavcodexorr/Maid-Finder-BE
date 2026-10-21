const { uploadBufferToS3 } = require('../utils/s3Upload');
const { isVideoMimetype } = require('../config/mimeTypes');
const MESSAGES = require('../config/errorMessages.json');

// Generic upload: the client can send the file under field name `file`,
// `image` or `video` — whichever reads naturally on that screen — so this
// just takes the first one that's actually present.
exports.uploadFile = async (req, res, next) => {
  try {
    const file =
      (Array.isArray(req.files) ? req.files[0] : null) ||
      req.file ||
      req.files?.file?.[0] ||
      req.files?.image?.[0] ||
      req.files?.video?.[0] ||
      req.files?.photo?.[0] ||
      (req.files && typeof req.files === 'object' ? Object.values(req.files)[0]?.[0] : null);
    if (!file) {
      return res.status(400).json({ success: false, message: MESSAGES.upload.noFileProvided });
    }
    const folder = isVideoMimetype(file.mimetype) ? 'help-zone/uploads/videos' : 'help-zone/uploads/images';
    const url = await uploadBufferToS3(file.buffer, file.mimetype, folder);
    res.json({ success: true, url });
  } catch (error) {
    next(error);
  }
};
