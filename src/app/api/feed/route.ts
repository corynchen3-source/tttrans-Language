import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cursor = searchParams.get("cursor") || undefined;
  const limit = parseInt(searchParams.get("limit") || "20");
  const sort = searchParams.get("sort") || "latest"; // latest, hot

  const orderBy: any = sort === "hot"
    ? [{ upvoteCount: "desc" as const }, { createdAt: "desc" as const }]
    : { createdAt: "desc" as const };

  const posts = await prisma.post.findMany({
    where: { visibility: "public" },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      _count: { select: { comments: true, upvotes: true } },
    },
    orderBy,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = posts.length > limit;
  return NextResponse.json({
    items: hasMore ? posts.slice(0, limit) : posts,
    nextCursor: hasMore ? posts[posts.length - 2].id : undefined,
    hasMore,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json();
  const post = await prisma.post.create({
    data: {
      authorId: session.user.id,
      postType: body.postType || "discussion",
      title: body.title,
      body: body.body,
      visibility: body.visibility || "public",
    },
    include: {
      author: { select: { username: true, displayName: true } },
    },
  });

  return NextResponse.json(post, { status: 201 });
}
