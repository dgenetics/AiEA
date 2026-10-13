import { prisma } from "@/lib/db";

export async function createWorkspaceForUser(
  userId: string,
  name: string,
  _userName: string,
) {
  const baseSlug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "workspace";
  const slug = `${baseSlug}-${userId.slice(-6)}`;

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      members: {
        create: { userId, role: "OWNER" },
      },
    },
  });

  return workspace;
}
