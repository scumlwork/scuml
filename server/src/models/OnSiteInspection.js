import mongoose from "mongoose";

// --- Current form, matching the Exam Report template ---
const documentRequestSchema = new mongoose.Schema(
  {
    document: { type: String, required: true },
    provided: { type: String, default: "" },
  },
  { _id: false }
);

const observationSchema = new mongoose.Schema(
  {
    requirement: { type: String, required: true },
    observation: { type: String, default: "" },
    recommendation: { type: String, default: "" },
  },
  { _id: false }
);

// --- Legacy sections (pre-redesign) — kept only so On-Site Inspections
// saved under the old form still load and display correctly; the current
// form no longer collects any of this.
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

    // Cover page
    coveragePeriod: { type: String, default: "" },
    dateOfExamination: { type: String, default: "" },
    areasCovered: { type: String, default: "" },
    structure: { type: String, default: "" },

    // Risk Assessment
    managementTeamInterviewed: { type: String, default: "" },
    documentsRequested: [documentRequestSchema],

    // Specific Findings / Material Exception
    specificFindings: { type: String, default: "" },
    materialException: { type: String, default: "" },

    // Politically Exposed Persons / Suspicious Transaction Reporting /
    // Targeted Financial Sanctions
    politicallyExposedPersons: { type: String, default: "" },
    suspiciousTransactionReporting: { type: String, default: "" },
    targetedFinancialSanctions: { type: String, default: "" },

    // Observations — AML/CFT Requirements assessment (includes the
    // Terrorism Prevention and Prohibition Act, 2022 rows)
    observations: [observationSchema],

    // Conclusion / Recommendations
    conclusionRecommendations: { type: String, default: "" },

    createdBy: { type: String, default: "" },

    // --- Legacy (pre-redesign) sections — see schemas above ---
    obligations: [obligationSchema],
    orgProfile: [orgProfileSchema],
    riskClassification: riskClassificationSchema,
    attendance: [attendanceSchema],
  },
  { timestamps: true }
);

export default mongoose.model("OnSiteInspection", OnSiteInspectionSchema);
