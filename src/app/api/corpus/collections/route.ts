import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { corpusService } from "@/lib/services/corpus.service";

export const dynamic = "force-dynamic";

/** 获取我的语料库集合列表 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const tag = req.nextUrl.searchParams.get("tag") || undefined;
  const collections = await corpusService.listCollections(session.user.id, tag);
  return NextResponse.json(collections);
}

/** 创建语料库集合（文件夹） */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await req.json();
  const collection = await corpusService.createCollection(
    session.user.id,
    body.name,
    body.description,
    body.tags,
    body.visibility
  );

  return NextResponse.json(collection, { status: 201 });
}
