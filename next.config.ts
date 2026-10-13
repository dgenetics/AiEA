import type { NextConfig } from "next";

/** Live bf-maintenance deployment. The only rewrite definition (not also vercel.json). */
const BF_MAINTENANCE_ORIGIN = "https://bf-maintenance.vercel.app";

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
  // Multi-zone: bf-maintenance is a separate deployment, served at /maintenance.
  // beforeFiles so this wins before any AiEA page or public file.
  // The child app must set basePath and assetPrefix to /maintenance or its
  // JS, CSS, and /api calls stay on / and hit AiEA. See the PR description.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/maintenance",
          destination: `${BF_MAINTENANCE_ORIGIN}/maintenance`,
        },
        {
          source: "/maintenance/:path*",
          destination: `${BF_MAINTENANCE_ORIGIN}/maintenance/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
