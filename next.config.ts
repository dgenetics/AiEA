import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native/optional DB drivers external on Vercel Node
  serverExternalPackages: [
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "@libsql/client",
    "@prisma/adapter-libsql",
  ],
  // One Tasks board replaced Today / Upcoming. Temporary (307) so old
  // bookmarks keep working without browsers caching a permanent redirect.
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
