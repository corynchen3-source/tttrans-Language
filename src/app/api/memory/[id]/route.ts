import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { memoryService } from "@/lib/services/memory.service";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const body = await req.json();
    const entry = await memoryService.update(params.id, session.user.id, body);
    return NextResponse.json(entry);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    await memoryService.delete(params.id, session.user.id);
    return NextResponse.json({ message: "删除成功" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
}

/** 从语料库导入到记忆库 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const result = await memoryService.importFromCorpus(session.user.id, params.id);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
