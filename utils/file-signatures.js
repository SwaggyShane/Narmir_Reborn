// Magic-byte validation for user-uploaded files. The fileFilter and MIME
// header that multer provides are derived from client-supplied data and can
// be forged trivially — relying on them means a file labeled `.png` can
// contain arbitrary bytes (HTML payloads, shell scripts, malware). We re-check
// the leading bytes of the buffer against the format's well-known signature
// before persisting to disk.
//
// References: https://en.wikipedia.org/wiki/List_of_file_signatures

function bytesMatch(buf, sig, offset = 0) {
  if (!buf || buf.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[offset + i] !== sig[i]) return false;
  }
  return true;
}

function isJpeg(buf) {
  // SOI marker FF D8 FF
  return bytesMatch(buf, [0xff, 0xd8, 0xff]);
}

function isPng(buf) {
  return bytesMatch(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function isGif(buf) {
  // GIF87a or GIF89a
  return bytesMatch(buf, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
         bytesMatch(buf, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
}

function isWebp(buf) {
  // RIFF....WEBP
  return bytesMatch(buf, [0x52, 0x49, 0x46, 0x46])
    && bytesMatch(buf, [0x57, 0x45, 0x42, 0x50], 8);
}

function isWav(buf) {
  // RIFF....WAVE
  return bytesMatch(buf, [0x52, 0x49, 0x46, 0x46])
    && bytesMatch(buf, [0x57, 0x41, 0x56, 0x45], 8);
}

function isMp3(buf) {
  if (!buf || buf.length < 3) return false;
  // ID3v2-tagged MP3
  if (bytesMatch(buf, [0x49, 0x44, 0x33])) return true;
  // MPEG audio frame sync: byte0 = 0xFF, byte1 top 3 bits set (frame sync),
  // and byte1 bits 3-4 (version) and bits 1-2 (layer) must not be reserved.
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
    const versionBits = (buf[1] >> 3) & 0x3; // not 01 (reserved)
    const layerBits = (buf[1] >> 1) & 0x3;   // not 00 (reserved)
    if (versionBits !== 0x1 && layerBits !== 0x0) return true;
  }
  return false;
}

const IMAGE_VALIDATORS = {
  '.jpg':  isJpeg,
  '.jpeg': isJpeg,
  '.png':  isPng,
  '.gif':  isGif,
  '.webp': isWebp,
};

const AUDIO_VALIDATORS = {
  '.mp3': isMp3,
  '.wav': isWav,
};

// Returns true if the buffer's leading bytes match the format declared by
// `ext` (lowercase, including the dot). Used to defend against mislabeled
// uploads after multer's MIME/extension check.
function validateImageSignature(buf, ext) {
  const fn = IMAGE_VALIDATORS[ext];
  return typeof fn === 'function' && fn(buf);
}

function validateAudioSignature(buf, ext) {
  const fn = AUDIO_VALIDATORS[ext];
  return typeof fn === 'function' && fn(buf);
}

module.exports = {
  validateImageSignature,
  validateAudioSignature,
  // Exported for tests:
  isJpeg, isPng, isGif, isWebp, isMp3, isWav,
};
