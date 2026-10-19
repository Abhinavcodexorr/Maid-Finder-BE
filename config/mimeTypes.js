const IMAGE_MIMETYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ID_DOCUMENT_MIMETYPES = [...IMAGE_MIMETYPES, 'application/pdf'];
const VIDEO_MIMETYPES = [
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
  'video/3gpp', 'video/3gpp2', 'video/avi', 'video/x-msvideo',
  'video/mpeg', 'video/ogg', 'video/x-flv', 'video/x-ms-wmv',
];

// Some Android camera/gallery apps report a generic binary type instead of
// a proper video/* mimetype, so this checks the VIDEO_MIMETYPES list and
// falls back to any "video/*" prefix, and callers that want to be lenient
// can also allow 'application/octet-stream' explicitly where that's safe.
const isVideoMimetype = (mimetype) =>
  VIDEO_MIMETYPES.includes(mimetype) || mimetype.startsWith('video/');

module.exports = { IMAGE_MIMETYPES, ID_DOCUMENT_MIMETYPES, VIDEO_MIMETYPES, isVideoMimetype };
