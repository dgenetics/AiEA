import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native/optional DB drivers external on Vercel Node
  serverExternalPackages: [
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "@libsql/client",
    "@prisma/adapter-libsql",
  ],
  // Backup if proxy.ts is not applied. Proxy owns the 308 for these paths.
  async redirects() {
    return [
      { source: "/today", destination: "/tasks", permanent: false },
      { source: "/today/:path*", destination: "/tasks", permanent: false },
      { source: "/upcoming", destination: "/tasks", permanent: false },
      { source: "/upcoming/:path*", destination: "/tasks", permanent: false },
    ];
  },
};

export default nextConfig;
