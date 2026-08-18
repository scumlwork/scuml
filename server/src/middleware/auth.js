export function requireAuth(req, res, next) {
if (req.session?.user) return next();
return res.status(401).json({ error: 'Not authenticated' });
}


// User.role is only ever 'superadmin' or 'staff' (see src/models/User.js) —
// this used to check for a nonexistent 'admin' role, meaning it could never
// pass; fixed rather than left as a landmine for whoever wires it up next.
export function requireAdmin(req, res, next) {
if (req.session?.user?.role === 'superadmin') return next();
return res.status(403).json({ error: 'Admin only' });
}

export function requireSuperadmin(req, res, next) {
if (req.session?.user?.role === 'superadmin') return next();
return res.status(403).json({ error: 'Super admin access required' });
}

// Owner is a single distinguished account (durable isOwner flag, not tied to
// a username) — gates user management and the audit log even from other
// superadmin accounts.
export function requireOwner(req, res, next) {
if (req.session?.user?.role === 'superadmin' && req.session?.user?.isOwner) return next();
return res.status(403).json({ error: 'Owner access required' });
}