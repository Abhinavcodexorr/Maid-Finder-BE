const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/s3');
const { v4: uuidv4 } = require('uuid');

const BUCKET = process.env.AWS_S3_BUCKET;

const getFileExtension = (mimetype) => {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  return map[mimetype] || 'jpg';
};

exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }
    if (!BUCKET) {
      return res.status(500).json({ success: false, message: 'S3 bucket not configured' });
    }
    const ext = getFileExtension(req.file.mimetype);
    const key = `maid-finder/${uuidv4()}.${ext}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });
    await s3Client.send(command);
    const url = `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    res.json({ success: true, url });
  } catch (error) {
    next(error);
  }
};
