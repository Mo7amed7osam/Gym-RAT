import type { NextConfig } from "next";

import { parseApiOrigin } from "./src/lib/api-origin";

/**
 * Gym RAT admin dashboard (ADR-018): presentation only. Every page is a
 * client of the VPS API at NEXT_PUBLIC_API_ORIGIN, which the browser calls
 * directly with the API's own HttpOnly cookie; this app has no API routes,
 * no database, no secrets, and never sees passwords, TOTP codes or cookies.
 */
const apiOrigin = parseApiOrigin(process.env.NEXT_PUBLIC_API_ORIGIN);
if (!apiOrigin && process.env.VERCEL_ENV === "production") {
  throw new Error("NEXT_PUBLIC_API_ORIGIN must be set for the Production environment");
}

// React dev tooling needs eval(); production never does.
const scriptSrc = process.env.NODE_ENV === "development" ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";
// The browser may talk to this app and to the API origin, nothing else.
const connectSrc = apiOrigin ? `'self' ${apiOrigin}` : "'self'";

const nextConfig: NextConfig = {
  cacheComponents: false,
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src ${scriptSrc}; connect-src ${connectSrc}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
