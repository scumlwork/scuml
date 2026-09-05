import mongoose from "mongoose";

const OffSiteInspectionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    examinationDate: String,
    introduction: String,
    contact: String,
    officeAddress: String,
    telephone: String,
    sources: String,
    complianceStatus: String,
    rc: String,
    scuml: String,
    tin: String,
    transactionReporting: String,
   shareholders: [
  {
    name: { type: String },
    pepStatus: { type: String },
    nonResident: { type: String },
    foreigner: { type: String },
    sanctionList: { type: String },
  }
],
    politicallyExposed: String,
    affiliates: String,
    legalIssues: String,
    locations: String,
    products: String,
    recommendation: String,

    // "form" (default) fills in the fields above; "document" instead
    // attaches a Word/Excel/PDF report, stored on Cloudinary, in place of
    // the form fields — the two are mutually exclusive per record.
    mode: { type: String, enum: ["form", "document"], default: "form" },
    documentUrl: { type: String, default: "" },
    documentPublicId: { type: String, default: "" },
    documentOriginalName: { type: String, default: "" },
    documentFileSize: { type: Number, default: 0 },

    createdBy: String,
  },
  { timestamps: true }
);

export default mongoose.model("OffSiteInspection", OffSiteInspectionSchema);
