import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const team = await prisma.team.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, username: true, displayName: true } },
      members: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } } },
      _count: { select: { corpusEntries: true, glossaryTerms: true } },
    },
  });
  if (!team) return NextResponse.json({ error: "团队不存在" }, { status: 404 });
  return NextResponse.json(team);
}
