import { NextResponse } from "next/server";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";

export async function requireWorkspace() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) {
    return {
      error: NextResponse.json({ error: "No workspace" }, { status: 400 }),
    } as const;
  }
  return { user, workspaceId } as const;
}
