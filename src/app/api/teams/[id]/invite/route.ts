import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  // 检查权限
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: params.id, userId: session.user.id } },
  });
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return NextResponse.json({ error: "无权邀请成员" }, { status: 403 });
  }

  const { username } = await req.json();
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  // 检查是否已是成员
  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: params.id, userId: user.id } },
  });
  if (existing) return NextResponse.json({ error: "该用户已在团队中" }, { status: 400 });

  await prisma.teamMember.create({
    data: { teamId: params.id, userId: user.id, role: "member" },
  });

  // 发送通知
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "team_invite",
      title: "你被邀请加入团队",
      body: `你已被邀请加入团队`,
    },
  });

  return NextResponse.json({ message: "邀请成功", username: user.username });
}
