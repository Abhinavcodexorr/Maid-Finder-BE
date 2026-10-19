const { execFile } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { uploadBufferToS3 } = require('./s3Upload');

// Phone videos are often 4K HEVC (H.265), which many browsers can't decode, so the
// admin panel can't show a frame or play them inline. This makes (best effort, needs
// the `ffmpeg` binary on the server):
//   - a small JPEG thumbnail, and
//   - a web-friendly H.264 720p MP4 with the index up front (starts playing at once).
// If ffmpeg is missing or fails, callers keep the original upload untouched.

const run = (args, timeout) =>
  new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { timeout }, (error) =>
      error ? reject(error) : resolve()
    );
  });

const tempPath = (ext) => path.join(os.tmpdir(), `hz-${uuidv4()}.${ext}`);

// `input` is a local file path or an http(s) URL.
const makeThumbnail = async (input) => {
  const out = tempPath('jpg');
  try {
    await run(['-ss', '0.5', '-i', input, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '3', out], 60_000);
    return await uploadBufferToS3(await fs.readFile(out), 'image/jpeg', 'help-zone/video-thumbnails');
  } finally {
    fs.rm(out, { force: true }).catch(() => {});
  }
};

const makeWebVideo = async (input) => {
  const out = tempPath('mp4');
  try {
    await run(
      [
        '-i', input,
        '-vf', "scale='min(1280,iw)':-2,format=yuv420p",
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        out,
      ],
      30 * 60_000
    );
    return await uploadBufferToS3(await fs.readFile(out), 'video/mp4', 'help-zone/videos');
  } finally {
    fs.rm(out, { force: true }).catch(() => {});
  }
};

// Saves an uploaded video buffer to a temp file for ffmpeg; returns { path, cleanup }.
const stageBuffer = async (buffer) => {
  const file = tempPath('video');
  await fs.writeFile(file, buffer);
  return { path: file, cleanup: () => fs.rm(file, { force: true }).catch(() => {}) };
};

module.exports = { makeThumbnail, makeWebVideo, stageBuffer };
