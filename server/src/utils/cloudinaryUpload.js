// server/src/utils/cloudinaryUpload.js
// Manual buffer -> Cloudinary upload. Used instead of multer-storage-cloudinary
// (which streams straight to Cloudinary as the file arrives) so a file can be
// malware-scanned first and rejected before it ever reaches Cloudinary.
import cloudinary from "../config/cloudinary.js";

export function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}
