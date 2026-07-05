import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { corpusService } from "@/lib/services/corpus.service";

/** 获取单条语料 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const entry = await corpusService.getById(params.id);
  if (!entry) {
    return NextResponse.json({ error: "语料不存在" }, { status: 404 });
  }
  return NextResponse.json(entry);
}

/** 更新语料 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const entry = await corpusService.update(params.id, session.user.id, body);
    return NextResponse.json(entry);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
}

/** 删除语料 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    await corpusService.delete(params.id, session.user.id);
    return NextResponse.json({ message: "删除成功" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
}

/** 从公开库导入到私人库 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await corpusService.importFromPublic(
      session.user.id,
      params.id,
      body.collectionId
    );
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
