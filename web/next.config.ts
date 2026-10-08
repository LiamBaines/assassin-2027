import type { NextConfig } from "next";

// Cache Components is deliberately off. Every page reads the Supabase session
// and calls the API per request, and redirect()/notFound() should set real HTTP
// status codes rather than stream into a prerendered shell.
const nextConfig: NextConfig = {
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
