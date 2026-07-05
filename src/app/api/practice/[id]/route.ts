import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** 获取练习详情（含所有提交记录） */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const practice = await prisma.practiceSession.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, username: true, displayName: true } },
      submissions: {
        include: {
          user: { select: { id: true, username: true, displayName: true } },
          score: true,
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!practice) return NextResponse.json({ error: "练习不存在" }, { status: 404 });
  return NextResponse.json(practice);
}
