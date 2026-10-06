const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const { s3Client } = require('../config/s3');

const EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const uploadBufferToS3 = async (buffer, mimetype, folder) => {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    const error = new Error('S3 bucket not configured');
    error.statusCode = 500;
    throw error;
  }
  const ext = EXTENSION_BY_MIME[mimetype] || 'bin';
  const key = `${folder}/${uuidv4()}.${ext}`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    })
  );
  const region = process.env.AWS_REGION || 'us-east-1';
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
};

module.exports = { uploadBufferToS3 };
