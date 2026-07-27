import type { NextConfig } from "next";

const scriptSource =
  process.env.NODE_ENV === "development"
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
let apiOrigin = "http://localhost:8000";
try {
  apiOrigin = new URL(apiBaseUrl).origin;
} catch {
  // Keep the development default if an invalid API URL is configured.
}
const connectSource =
  process.env.NODE_ENV === "development" ? `'self' ${apiOrigin}` : "'self' https:";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self)" },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; img-src 'self' blob: data:; connect-src ${connectSource}; script-src ${scriptSource}; style-src 'self' 'unsafe-inline'; base-uri 'self'; frame-ancestors 'none'`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
