import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const projects = await prisma.subtitleProject.findMany({
    where: { ownerId: session.user.id },
    include: { _count: { select: { segments: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json();
  const project = await prisma.subtitleProject.create({
    data: {
      ownerId: session.user.id,
      title: body.title || "未命名字幕项目",
      sourceType: body.sourceType || "file_upload",
      sourceLang: body.sourceLang || "en",
      targetLang: body.targetLang || "zh",
    },
  });

  return NextResponse.json(project, { status: 201 });
}
