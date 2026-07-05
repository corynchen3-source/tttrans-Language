import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { corpusService } from "@/lib/services/corpus.service";

export const dynamic = "force-dynamic";

/** 获取集合中的语料 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = req.nextUrl;
  const result = await corpusService.getCollectionEntries(params.id, {
    cursor: searchParams.get("cursor") || undefined,
    limit: parseInt(searchParams.get("limit") || "20"),
  });
  return NextResponse.json(result);
}

/** 添加语料到集合 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const { entryId } = await req.json();
    const item = await corpusService.addToCollection(params.id, entryId, session.user.id);
    return NextResponse.json(item, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

/** 更新集合（重命名、改标签等） */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const body = await req.json();
    const result = await corpusService.updateCollection(params.id, session.user.id, body);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

/** 删除集合 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    await corpusService.deleteCollection(params.id, session.user.id);
    return NextResponse.json({ message: "文件夹已删除" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
