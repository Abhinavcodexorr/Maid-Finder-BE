const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
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

// Extracts the S3 object key from a stored full URL (works for the
// virtual-hosted-style URLs uploadBufferToS3 produces).
const keyFromPublicUrl = (url) => {
  if (!url) return null;
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    return null;
  }
};

// The bucket is private, so admin/API responses must hand out short-lived
// signed links rather than the permanent public-style URL that gets stored.
const presignUrl = async (storedUrl, expiresInSeconds = 3600) => {
  const key = keyFromPublicUrl(storedUrl);
  if (!key) return storedUrl;
  const bucket = process.env.AWS_S3_BUCKET;
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};

module.exports = { uploadBufferToS3, presignUrl };
