import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { corpusService } from "@/lib/services/corpus.service";

export const dynamic = "force-dynamic";

/** 获取语料列表（公开浏览 + 搜索） */
export async function GET(req: NextRequest) {
  const session = await auth();
  const { searchParams } = req.nextUrl;

  const result = await corpusService.list({
    search: searchParams.get("search") || undefined,
    domain: searchParams.get("domain") || undefined,
    sourceLang: searchParams.get("sourceLang") || undefined,
    targetLang: searchParams.get("targetLang") || undefined,
    ownerId: session?.user?.id,
    cursor: searchParams.get("cursor") || undefined,
    limit: parseInt(searchParams.get("limit") || "20"),
  });

  return NextResponse.json(result);
}

/** 创建语料条目 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await req.json();
  const result = await corpusService.create(session.user.id, body);

  return NextResponse.json(result, { status: result.isNew ? 201 : 200 });
}
