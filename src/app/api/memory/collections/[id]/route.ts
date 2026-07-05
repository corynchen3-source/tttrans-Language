import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { memoryService } from "@/lib/services/memory.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const entries = await memoryService.getCollectionEntries(params.id);
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const { entryId } = await req.json();
    await memoryService.addToCollection(params.id, entryId, session.user.id);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    await memoryService.deleteCollection(params.id, session.user.id);
    return NextResponse.json({ message: "删除成功" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
