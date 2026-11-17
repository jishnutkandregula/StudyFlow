import type { NextConfig } from "next";

// The browser talks only to the Next.js origin; /api/* is proxied to FastAPI.
// Keeping the API same-origin lets the session cookie stay SameSite=Lax and
// httpOnly without any cross-site cookie configuration.
const apiOrigin = process.env.STUDYFLOW_API_ORIGIN ?? "http://127.0.0.1:8000";
const isDev = process.env.NODE_ENV !== "production";

// Only Google Identity (Calendar sign-in) and Google Fonts are allowed off-origin.
// Next.js needs inline scripts for hydration; dev additionally needs eval for fast refresh.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  `connect-src 'self' https://www.googleapis.com https://accounts.google.com${isDev ? " ws:" : ""}`,
  "frame-src https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
