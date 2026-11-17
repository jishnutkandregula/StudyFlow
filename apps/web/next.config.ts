import type { NextConfig } from "next";

// The browser talks only to the Next.js origin; /api/* is proxied to FastAPI.
// Keeping the API same-origin lets the session cookie stay SameSite=Lax and
// httpOnly without any cross-site cookie configuration.
const apiOrigin = process.env.STUDYFLOW_API_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
