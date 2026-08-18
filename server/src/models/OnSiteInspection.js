import mongoose from "mongoose";

const obligationSchema = new mongoose.Schema(
  {
    obligation: { type: String, required: true },
    complianceStatus: { type: String, default: "" },
    remark: { type: String, default: "" },
  },
  { _id: false }
);

const orgProfileSchema = new mongoose.Schema(
  {
    desc: { type: String, required: true },
    remark: { type: String, default: "" },
  },
  { _id: false }
);

const riskClassificationSchema = new mongoose.Schema(
  {
    level: { type: String, enum: ["low", "medium", "high"], default: "low" },
    vulnerabilities: { type: String, default: "" },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    organization: { type: String, default: "" },
    position: { type: String, default: "" },
    phone: { type: String, default: "" },
    sign: { type: String, default: "" },
  },
  { _id: false }
);

const OnSiteInspectionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },

    // Compliance with the Law & Regulation
    obligations: [obligationSchema],

    // Organization Profile
    orgProfile: [orgProfileSchema],

    // Money Laundering Risk Classification
    riskClassification: riskClassificationSchema,

    // Attendance
    attendance: [attendanceSchema],

    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("OnSiteInspection", OnSiteInspectionSchema);
