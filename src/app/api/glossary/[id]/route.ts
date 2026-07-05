import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { glossaryService } from "@/lib/services/glossary.service";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const body = await req.json();
    const term = await glossaryService.update(params.id, session.user.id, body);
    return NextResponse.json(term);
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
    await glossaryService.delete(params.id, session.user.id);
    return NextResponse.json({ message: "删除成功" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
}
