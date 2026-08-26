// server/src/routes/violationRoutes.js
import express from "express";
import Violation from "../models/Violation.js";
import Registration from "../models/Registration.js";
import { requireAuth, requireSuperadmin, requireStaffOrAbove } from "../middleware/auth.js";
import { escapeRegex, omitProtectedFields } from "../utils/sanitizeHelpers.js";
import { recordRecentActivity, clearRecentActivityFor } from "../utils/recentActivity.js";

const router = express.Router();

// Guest accounts may only act on the Identification section.
router.use(requireStaffOrAbove);

// 🔹 Create new violation
router.post("/", requireAuth, async (req, res) => {
  try {
    const username = req.session?.user?.username;
    if (!username) return res.status(401).json({ error: "Unauthorized" });

    const { company, amountSanctioned, amountPaid } = req.body;

    // Ensure company exists
    const existingCompany = await Registration.findById(company);
    if (!existingCompany) {
      return res.status(400).json({ error: "Company not found" });
    }

    // Create violation. Any amount already paid at creation counts as the
    // first entry in the payment history.
    const violation = new Violation({
      company,
      amountSanctioned,
      amountPaid,
      payments: amountPaid > 0 ? [{ amount: amountPaid, date: new Date(), enteredBy: username }] : [],
      createdBy: username,
    });

    await violation.save();

    // 🔹 Add violation reference to the registration (atomic update)
    await Registration.findByIdAndUpdate(company, {
      $push: { violations: violation._id },
    });

    await recordRecentActivity({
      type: "violation",
      refId: violation._id,
      companyId: existingCompany._id,
      companyName: existingCompany.companyName,
      summary: `Violation of ₦${amountSanctioned} for ${existingCompany.companyName}`,
      createdBy: username,
    });

    res.status(201).json(violation);
  } catch (err) {
    console.error("❌ Error creating violation:", err);
    res.status(400).json({ error: "Invalid request" });
  }
});

// 🔹 Search companies by name. Each result includes the company's single
// open (not yet fully paid) violation, if any — a part-payment must be
// applied to that same record instead of creating a new one, otherwise the
// balance double-counts (the original sanctioned amount would be re-added
// on top of the remaining balance every time a payment is made).
router.get("/search", requireAuth, async (req, res) => {
  try {
    const query = req.query.query || "";
    if (!query) return res.json([]);

    const companies = await Registration.find({
      companyName: { $regex: `^${escapeRegex(query)}`, $options: "i" },
    }).select("companyName _id");

    const results = await Promise.all(
      companies.map(async (c) => {
        // Oldest still-open violation is the one running balance for this company
        const openViolation = await Violation.findOne({
          company: c._id,
          $expr: { $gt: ["$amountSanctioned", "$amountPaid"] },
        }).sort({ createdAt: 1 });

        return {
          _id: c._id,
          companyName: c.companyName,
          outstandingBalance: openViolation
            ? openViolation.amountSanctioned - openViolation.amountPaid
            : 0,
          openViolationId: openViolation ? openViolation._id : null,
          amountSanctioned: openViolation ? openViolation.amountSanctioned : null,
          amountPaidSoFar: openViolation ? openViolation.amountPaid : null,
        };
      })
    );

    res.json(results);
  } catch (err) {
    console.error("❌ Error in violations search:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// 🔹 Apply a part-payment to an existing open violation (adds to amountPaid
// instead of creating a new violation row, so the balance is only ever
// reduced, never re-added to).
router.put("/:id/pay", requireAuth, async (req, res) => {
  try {
    const username = req.session?.user?.username;
    if (!username) return res.status(401).json({ error: "Unauthorized" });

    const paymentAmount = Number(req.body.paymentAmount);
    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ error: "Payment amount must be greater than 0" });
    }

    const violation = await Violation.findById(req.params.id);
    if (!violation) return res.status(404).json({ error: "Violation not found" });

    violation.amountPaid += paymentAmount;
    violation.payments.push({ amount: paymentAmount, date: new Date(), enteredBy: username });
    await violation.save();

    res.json(violation);
  } catch (err) {
    console.error("❌ Error applying payment:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get all violations
router.get("/", requireAuth, async (req, res) => {
  try {
    const violations = await Violation.find()
      .populate("company", "companyName natureOfBusiness")
      .sort({ createdAt: -1 });

    res.json(violations);
  } catch (err) {
    console.error("❌ Error fetching violations:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get single violation
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const violation = await Violation.findById(req.params.id).populate(
      "company",
      "companyName natureOfBusiness"
    );

    if (!violation) return res.status(404).json({ error: "Violation not found" });

    res.json(violation);
  } catch (err) {
    console.error("❌ Error fetching violation:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Edit violation by ID
router.put("/:id", requireAuth, async (req, res) => {
  try {
    // payments is an append-only audit trail owned by /:id/pay — a direct
    // edit here must not be able to inject or overwrite it.
    const body = omitProtectedFields(req.body);
    delete body.payments;

    const updatedViolation = await Violation.findByIdAndUpdate(
      req.params.id,
      // Whoever edits a record becomes its new "Entered by" — multiple
      // people can touch the same entry over time, so it should always
      // reflect who most recently entered its current content.
      { ...body, createdBy: req.session.user.username },
      { new: true, runValidators: true }
    );

    if (!updatedViolation) {
      return res.status(404).json({ error: "Violation not found" });
    }

    res.json(updatedViolation);
  } catch (err) {
    console.error("❌ Error updating violation:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Delete violation by ID
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const violation = await Violation.findByIdAndDelete(req.params.id);

    if (!violation) {
      return res.status(404).json({ error: "Violation not found" });
    }

    // 🔹 Remove violation reference from Registration
    await Registration.findByIdAndUpdate(violation.company, {
      $pull: { violations: violation._id },
    });
    await clearRecentActivityFor(violation._id);

    res.json({ message: "Violation deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting violation:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Clear all violations — destructive + collection-wide, superadmin only
router.delete("/clear-all", requireSuperadmin, async (req, res) => {
  try {
    await Violation.deleteMany({});
    // Remove all violation references from registrations
    await Registration.updateMany({}, { $set: { violations: [] } });

    res.json({ message: "All violations cleared successfully" });
  } catch (err) {
    console.error("❌ Error clearing violations:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
