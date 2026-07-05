import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const teams = await prisma.team.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
      _count: { select: { members: true } },
      owner: { select: { username: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(teams);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json();
  const slug = body.name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now().toString(36);

  const team = await prisma.team.create({
    data: {
      name: body.name,
      slug,
      description: body.description,
      ownerId: session.user.id,
    },
  });

  // 创建者自动成为成员
  await prisma.teamMember.create({
    data: { teamId: team.id, userId: session.user.id, role: "owner" },
  });

  return NextResponse.json(team, { status: 201 });
}
