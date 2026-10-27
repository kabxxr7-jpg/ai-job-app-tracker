import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents/partialPrefetching (Next 16's experimental PPR-successor) require
  // Suspense/`"use cache"` annotations on every dynamic read. This app is a fully dynamic,
  // auth-gated CRUD app with no meaningfully cacheable pages, so that machinery is disabled
  // in favor of standard per-request rendering.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
