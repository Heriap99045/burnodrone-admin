import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Isi hanya jika di-host di subpath (mis. GitHub Pages: "/nama-repo"). Kosongkan untuk Vercel.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  trailingSlash: true,
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
