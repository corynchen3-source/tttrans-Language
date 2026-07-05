import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const comments = await prisma.postComment.findMany({
    where: { postId: params.id, parentId: null },
    include: {
      author: { select: { username: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { body } = await req.json();
  const comment = await prisma.postComment.create({
    data: {
      postId: params.id,
      authorId: session.user.id,
      body,
    },
    include: { author: { select: { username: true, displayName: true } } },
  });

  await prisma.post.update({
    where: { id: params.id },
    data: { commentCount: { increment: 1 } },
  });

  // 通知帖子作者
  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (post && post.authorId !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: post.authorId,
        type: "post_comment",
        title: "有人评论了你的帖子",
        body: body.slice(0, 100),
        entityType: "post",
        entityId: params.id,
      },
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
