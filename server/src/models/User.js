import mongoose from 'mongoose';
import argon2 from 'argon2';


const FailedLoginSchema = new mongoose.Schema({
count: { type: Number, default: 0 },
lastAttempt: { type: Date, default: null },
lockUntil: { type: Date, default: null }
}, { _id: false });


const UserSchema = new mongoose.Schema(
{
username: { type: String, required: true, unique: true, index: true, trim: true, minlength: 3, maxlength: 64 },
passwordHash: { type: String, required: true },
role: { type: String, enum: ['superadmin', 'staff'], default: 'staff' },
// A single account (the original superadmin) — owner status is a durable
// flag rather than a hardcoded username check, since usernames can be
// renamed. Grants exclusive access to user management and the audit log,
// even from other superadmin accounts.
isOwner: { type: Boolean, default: false },
isActive: { type: Boolean, default: true },
photoUrl: { type: String, default: '' },
// Optional: TOTP secret for 2FA (base32)
totpSecret: { type: String, default: '' },
failedLogin: { type: FailedLoginSchema, default: () => ({}) }
},
{ timestamps: true }
);


UserSchema.methods.setPassword = async function (plain) {
this.passwordHash = await argon2.hash(plain, { type: argon2.argon2id, timeCost: 3, memoryCost: 19456, parallelism: 1 });
};


UserSchema.methods.verifyPassword = async function (plain) {
return argon2.verify(this.passwordHash, plain);
};


export default mongoose.model('User', UserSchema);