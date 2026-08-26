// server/src/utils/recentActivity.js
import RecentActivity from "../models/RecentActivity.js";

// Best-effort — a logging failure should never break the actual create/delete.
export async function recordRecentActivity(entry) {
  try {
    await RecentActivity.create(entry);
  } catch (err) {
    console.error("Failed to record recent activity:", err);
  }
}

export async function clearRecentActivityFor(refId) {
  try {
    await RecentActivity.deleteMany({ refId });
  } catch (err) {
    console.error("Failed to clear recent activity:", err);
  }
}

export async function clearRecentActivityForMany(refIds) {
  try {
    await RecentActivity.deleteMany({ refId: { $in: refIds } });
  } catch (err) {
    console.error("Failed to clear recent activity:", err);
  }
}
