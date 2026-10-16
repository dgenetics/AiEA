import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native/optional DB drivers external on Vercel Node
  serverExternalPackages: [
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "@libsql/client",
    "@prisma/adapter-libsql",
    "sharp",
  ],
  // Backup redirects if proxy.ts is not applied.
  // Signed-in `/` → `/tasks` is handled in proxy.ts and src/app/page.tsx.
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
