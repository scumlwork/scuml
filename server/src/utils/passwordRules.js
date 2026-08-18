// server/src/utils/passwordRules.js
// Shared password strength requirements — used by registration, self-service
// resets, and superadmin-triggered resets so the rule set never drifts.
export const PASSWORD_RULES = [
  { id: "length", test: (p) => p.length >= 10, message: "At least 10 characters" },
  { id: "uppercase", test: (p) => /[A-Z]/.test(p), message: "One uppercase letter" },
  { id: "lowercase", test: (p) => /[a-z]/.test(p), message: "One lowercase letter" },
  { id: "number", test: (p) => /[0-9]/.test(p), message: "One number" },
  { id: "special", test: (p) => /[^A-Za-z0-9]/.test(p), message: "One special character" },
];

export function validatePasswordStrength(password) {
  const failed = PASSWORD_RULES.filter((rule) => !rule.test(password || ""));
  return failed.map((rule) => rule.message);
}
