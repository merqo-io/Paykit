import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,

  serverExternalPackages: [
    "tesseract.js",
    "tesseract.js-core",
    "bmp-js",
    "zlibjs",
    "wasm-feature-detect",
  ],
  // The claim route reads the amount out of a payment screenshot with
  // Tesseract (src/lib/proof-ocr.ts). Its worker thread loads these files by
  // path at run time, which the build's own tracing cannot see. Name real
  // package folders only: a glob that matches one of pnpm's linked folders
  // fails the build on Windows.
  outputFileTracingIncludes: {
    // The key is a glob, so the route's [id] segment is written as *.
    "/api/v1/checkout/*/claim": [
      "./ocr-data/*",
      "./node_modules/wasm-feature-detect/**/*",
      "./node_modules/.pnpm/tesseract.js@5.1.1/node_modules/tesseract.js/**/*",
      "./node_modules/.pnpm/tesseract.js-core@5.1.1/node_modules/tesseract.js-core/*",
      "./node_modules/.pnpm/{bmp-js,is-electron,is-url,regenerator-runtime,wasm-feature-detect,zlibjs}@*/node_modules/*/**/*",
      "./node_modules/.pnpm/node-fetch@2.7.0/node_modules/node-fetch/**/*",
      "./node_modules/.pnpm/whatwg-url@5.0.0/node_modules/whatwg-url/**/*",
      "./node_modules/.pnpm/tr46@0.0.3/node_modules/tr46/**/*",
      "./node_modules/.pnpm/webidl-conversions@3.0.1/node_modules/webidl-conversions/**/*",
    ],
  },

  // The hosted pay page sends the customer's payment screenshot through a
  // server action. The file may be up to 1 MB and the default limit for an
  // action's body is 1 MB with nothing to spare for the form around it.
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },

  // sharp is only next's optional peer; Vercel optimizes images itself, so keep its binary out of every function.
  outputFileTracingExcludes: {
    "*": ["node_modules/@img/**", "node_modules/sharp/**"],
  },

  images: {
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", port: "54321" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },

  async headers() {
    const isProd = process.env.NODE_ENV === "production";

    const connectSrc = isProd
      ? "connect-src 'self' https://*.supabase.co wss://*.supabase.co"
      : "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:54321 ws://127.0.0.1:54321";

    const imgSrc = isProd
      ? "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com"
      : "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com http://127.0.0.1:54321";

    const scriptSrc = isProd
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

    // X-Frame-Options: DENY and the CSP's frame-ancestors 'none' both block
    // any <iframe> from rendering this app — including an IDE's embedded
    // preview pane, which next dev serves under this same headers() config.
    // Scoped to production only, matching connectSrc/imgSrc/scriptSrc above.
    const cspDirectives = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      imgSrc,
      "font-src 'self' data:",
      connectSrc,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ];
    if (isProd) cspDirectives.push("frame-ancestors 'none'");

    return [
      {
        source: "/(.*)",
        headers: [
          ...(isProd ? [{ key: "X-Frame-Options", value: "DENY" }] : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-XSS-Protection", value: "0" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: cspDirectives.join("; "),
          },
        ],
      },
      // The pay link carries its token in the query string, so nothing the
      // page loads or links to is told where the customer came from. Listed
      // after the general rule: for a header both rules set, the later one
      // is the one sent.
      {
        source: "/pay/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
