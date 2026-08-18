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
    createdBy: String,
  },
  { timestamps: true }
);

export default mongoose.model("OffSiteInspection", OffSiteInspectionSchema);
