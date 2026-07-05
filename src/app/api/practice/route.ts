import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 获取练习列表 */
export async function GET(req: NextRequest) {
  const session = await auth();
  const { searchParams } = req.nextUrl;
  const cursor = searchParams.get("cursor") || undefined;
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: any = {
    OR: [{ visibility: "public" }, ...(session?.user?.id ? [{ userId: session.user.id }] : [])],
  };

  const sessions = await prisma.practiceSession.findMany({
    where,
    include: {
      user: { select: { id: true, username: true, displayName: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = sessions.length > limit;
  return NextResponse.json({
    items: hasMore ? sessions.slice(0, limit) : sessions,
    nextCursor: hasMore ? sessions[sessions.length - 2].id : undefined,
    hasMore,
  });
}

/** 创建练习 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json();
  const practice = await prisma.practiceSession.create({
    data: {
      userId: session.user.id,
      title: body.title,
      sourceText: body.sourceText,
      referenceTranslation: body.referenceTranslation,
      sourceLang: body.sourceLang || "en",
      targetLang: body.targetLang || "zh",
      practiceType: body.practiceType || "translation",
      difficulty: body.difficulty || "medium",
      domain: body.domain,
      visibility: body.visibility || "private",
    },
  });

  return NextResponse.json(practice, { status: 201 });
}
