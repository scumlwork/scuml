// generate-secret.js
import speakeasy from "speakeasy";

const secret = speakeasy.generateSecret({ length: 20 });
console.log("Your new base32 secret:", secret.base32);
console.log("Use this in your .env as ADMIN_TOTP_SECRET");
