// server/src/models/LibraryDocument.js
// Superadmin document library — PDFs stored on Cloudinary (see
// server/src/routes/libraryRoutes.js). `filename` is kept only for documents
// uploaded before the Cloudinary migration, which still serve from local
// disk; every new upload sets `url`/`publicId` instead.
import mongoose from "mongoose";

const LibraryDocumentSchema = new mongoose.Schema(
  {
    library: { type: String, default: "" }, // which library/collection this belongs to
    title: { type: String, default: "" },
    filename: { type: String, default: "" }, // legacy disk-stored name (uuid-based)
    url: { type: String, default: "" }, // Cloudinary secure_url
    publicId: { type: String, default: "" }, // Cloudinary public_id, needed to delete
    originalName: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.LibraryDocument ||
  mongoose.model("LibraryDocument", LibraryDocumentSchema);
