import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxies /api/* through this Next.js server to the real backend, so the
  // browser only ever talks to one origin. Without this, the frontend and
  // backend sit on two separate onrender.com domains — different "sites" —
  // and Safari/iOS's Intelligent Tracking Prevention blocks the session and
  // CSRF cookies on cross-site requests even with SameSite=None; Secure set.
  // BACKEND_ORIGIN is server-only (no NEXT_PUBLIC_ prefix) and unset in
  // local dev, so this is a no-op locally — dev keeps calling
  // NEXT_PUBLIC_BACKEND_URL (localhost:5000) directly, same as always.
  async rewrites() {
    const backendOrigin = process.env.BACKEND_ORIGIN;
    if (!backendOrigin) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
