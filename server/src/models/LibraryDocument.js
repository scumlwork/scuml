// server/src/models/LibraryDocument.js
// Superadmin document library — PDFs stored on local disk (see
// server/src/routes/libraryRoutes.js) rather than Cloudinary, per explicit
// request. This model just tracks the metadata + where the file lives.
import mongoose from "mongoose";

const LibraryDocumentSchema = new mongoose.Schema(
  {
    library: { type: String, default: "" }, // which library/collection this belongs to
    title: { type: String, default: "" },
    filename: { type: String, required: true }, // stored name on disk (uuid-based)
    originalName: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.LibraryDocument ||
  mongoose.model("LibraryDocument", LibraryDocumentSchema);
