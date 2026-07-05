import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const existing = await prisma.postUpvote.findUnique({
    where: { postId_userId: { postId: params.id, userId: session.user.id } },
  });

  if (existing) {
    await prisma.postUpvote.delete({ where: { postId_userId: { postId: params.id, userId: session.user.id } } });
    await prisma.post.update({ where: { id: params.id }, data: { upvoteCount: { decrement: 1 } } });
    return NextResponse.json({ upvoted: false });
  }

  await prisma.postUpvote.create({
    data: { postId: params.id, userId: session.user.id },
  });
  await prisma.post.update({ where: { id: params.id }, data: { upvoteCount: { increment: 1 } } });

  return NextResponse.json({ upvoted: true });
}
