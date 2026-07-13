import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const people = await prisma.person.findMany({
    where: { workspaceId },
    include: {
      tasks: {
        where: {
          status: { in: ["ACTIVE", "INBOX", "SNOOZED"] },
          isFollowUp: true,
        },
        orderBy: { followUpDueAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ people });
}

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().nullable(),
  company: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const body = schema.parse(await req.json());
  const person = await prisma.person.create({
    data: {
      workspaceId,
      name: body.name.trim(),
      email: body.email || null,
      company: body.company || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json({ person });
}
