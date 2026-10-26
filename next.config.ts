import type { NextConfig } from "next";

const OCR_FILES = [
  "./ocr-data/*",
  "./node_modules/wasm-feature-detect/**/*",
  "./node_modules/.pnpm/tesseract.js@5.1.1/node_modules/tesseract.js/**/*",
  "./node_modules/.pnpm/tesseract.js-core@5.1.1/node_modules/tesseract.js-core/*",
  "./node_modules/.pnpm/{bmp-js,is-electron,is-url,regenerator-runtime,wasm-feature-detect,zlibjs}@*/node_modules/*/**/*",
  "./node_modules/.pnpm/node-fetch@2.7.0/node_modules/node-fetch/**/*",
  "./node_modules/.pnpm/whatwg-url@5.0.0/node_modules/whatwg-url/**/*",
  "./node_modules/.pnpm/tr46@0.0.3/node_modules/tr46/**/*",
  "./node_modules/.pnpm/webidl-conversions@3.0.1/node_modules/webidl-conversions/**/*",
];

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
  // A claim reads the amount out of a payment screenshot with Tesseract
  // (src/lib/proof-ocr.ts). Its worker thread loads these files by path at
  // run time, which the build's own tracing cannot see. Name real package
  // folders only: a glob that matches one of pnpm's linked folders fails the
  // build on Windows. The keys are globs, so a route's [id] segment is
  // written as *. The pay page claims through the same function, so its
  // server action runs the same check and needs the same files.
  outputFileTracingIncludes: {
    "/api/v1/checkout/*/claim": OCR_FILES,
    "/pay/*": OCR_FILES,
  },

  // The hosted pay page sends the customer's payment screenshot through a
  // server action. The file may be up to 1 MB and the default limit for an
  // action's body is 1 MB with nothing to spare for the form around it.
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },

  // Vercel optimizes images itself, so sharp's binary stays out of every
  // function except the two that run the screenshot check. pnpm keeps the
  // real files under node_modules/.pnpm, which the last two globs reach.
  outputFileTracingExcludes: {
    "!{/pay/*,/api/v1/checkout/*/claim}": [
      "node_modules/{sharp,@img}/**",
      "node_modules/.pnpm/{sharp,@img+*}@*/**",
      "node_modules/**/node_modules/{sharp,@img}/**",
    ],
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

    // X-Frame-Options: DENY blocks any <iframe> from rendering this app,
    // including an IDE's embedded preview pane under next dev, so it is
    // production-only. The CSP and the non-production X-Robots-Tag are set per
    // request in src/proxy.ts.
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
      {
        source: "/inquire/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
