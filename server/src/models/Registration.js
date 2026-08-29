// server/src/models/Registration.js
import mongoose from "mongoose";

const RegistrationSchema = new mongoose.Schema(
  {
    serialNumber: { type: String, unique: true, sparse: true },
    officerName: { type: String, required: true },
    dateOfIdentification: { type: String, required: true },
    companyName: { type: String, required: true, unique: true },
    natureOfBusiness: { type: String, required: true },
    // Moved to the Spot Check form — captured there instead, per spot
    // check, rather than once at initial identification. Kept here
    // (optional now) only so existing registrations don't lose their
    // already-recorded value.
    companySize: {
      type: String,
      enum: ["", "Small", "Medium", "Large"],
      default: "",
    },
    address: { type: String, required: true },
    state: { type: String, enum: ["Edo", "Delta", "Ondo"], required: true },
    // Removed from the Identification form — kept here (optional) only so
    // existing registrations don't lose their already-recorded value.
    city: { type: String, default: "" },
    modeOfIdentification: {
      type: String,
      enum: ["Physical", "Online", "Social Media", "Newspaper"],
      required: true,
    },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },

    // Optional photo gallery — stored but never rendered in any view
    photos: { type: [String], default: [] },

    // Created-by metadata (not required for now to avoid breaking old docs)
    createdBy: { type: String, default: "" },

    // Relations
    letters: [{ type: mongoose.Schema.Types.ObjectId, ref: "Letter" }],
    sanctions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Sanction" }],
    offSiteInspections: [
      { type: mongoose.Schema.Types.ObjectId, ref: "OffSiteInspection" },
    ],

    // ✅ New Relations
    onSiteInspections: [
      { type: mongoose.Schema.Types.ObjectId, ref: "OnSiteInspection" },
    ],
    trainings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Training" }],
    violations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Violation" }],
    generatedLetters: [
      { type: mongoose.Schema.Types.ObjectId, ref: "GeneratedLetter" },
    ],
    spotChecks: [{ type: mongoose.Schema.Types.ObjectId, ref: "SpotCheck" }],
  },
  { timestamps: true }
);

// Avoid OverwriteModelError in dev with hot reload
export default mongoose.models.Registration ||
  mongoose.model("Registration", RegistrationSchema);
