// server/src/models/SpotCheck.js
import mongoose from "mongoose";

// Every Yes/No/Custom field on the form shares this shape — `value` is
// "Yes" | "No" | "Custom", and `custom` only holds something when the user
// picked Custom and typed their own answer.
const YesNoCustomSchema = new mongoose.Schema(
  {
    value: { type: String, default: "" },
    custom: { type: String, default: "" },
  },
  { _id: false }
);

const SpotCheckSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", required: true },

    registrationWithScuml: { type: YesNoCustomSchema, default: () => ({}) },
    scumlCertificateDisplay: { type: YesNoCustomSchema, default: () => ({}) },
    amlNoticeDisplay: { type: YesNoCustomSchema, default: () => ({}) },
    dateOfCommencement: { type: String, default: "" },
    dateOfSpotCheck: { type: String, default: "" },

    sector: {
      type: String,
      enum: ["", "Hotel & Hospitality Industries", "Automobile/Car Dealers", "Other Business"],
      default: "",
    },

    // Hotel & Hospitality Industries
    totalRooms: { type: String, default: "" },
    roomRateLowest: { type: Number },
    roomRateHighest: { type: Number },
    facility: { type: String, default: "" },
    facilityRateLowest: { type: Number },
    facilityRateHighest: { type: Number },
    occupancyRate: { type: String, default: "" },
    occupiedRooms: { type: String, default: "" },
    scumlReporting: { type: YesNoCustomSchema, default: () => ({}) },
    staffScumlAwareness: { type: YesNoCustomSchema, default: () => ({}) },

    // Automobile/Car Dealers
    avgVehicleType: { type: String, default: "" },
    avgVehicleNumber: { type: String, default: "" },
    avgPriceLowest: { type: Number },
    avgPriceHighest: { type: Number },
    customers: { type: String, default: "" },

    // Other Business
    typesOfServices: { type: String, default: "" },
    customersClients: { type: String, default: "" },
    majorCustomersClients: { type: String, default: "" },
    majorProjects: { type: String, default: "" },
    highestAmountReceived: { type: Number },
    dateOfLastTransaction: { type: String, default: "" },

    // Shown under every sector
    contactPerson: { type: String, default: "" },
    position: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    initiateLetter: { type: YesNoCustomSchema, default: () => ({}) },
    // Moved here from Registration — captured per spot check rather than
    // once at initial identification.
    companySize: {
      type: String,
      enum: ["", "Small", "Medium", "Large"],
      default: "",
    },

    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.SpotCheck || mongoose.model("SpotCheck", SpotCheckSchema);
