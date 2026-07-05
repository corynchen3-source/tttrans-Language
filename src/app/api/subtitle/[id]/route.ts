import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.subtitleProject.findUnique({
    where: { id: params.id },
    include: {
      segments: { orderBy: { sequence: "asc" } },
    },
  });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const project = await prisma.subtitleProject.findUnique({ where: { id: params.id } });
  if (!project || project.ownerId !== session.user.id) {
    return NextResponse.json({ error: "无权删除" }, { status: 403 });
  }

  await prisma.subtitleProject.delete({ where: { id: params.id } });
  return NextResponse.json({ message: "删除成功" });
}
