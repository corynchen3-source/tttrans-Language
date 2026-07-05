import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { glossaryService } from "@/lib/services/glossary.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const terms = await glossaryService.getCollectionTerms(params.id);
  return NextResponse.json(terms);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const { termId } = await req.json();
    await glossaryService.addToCollection(params.id, termId, session.user.id);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    await glossaryService.deleteCollection(params.id, session.user.id);
    return NextResponse.json({ message: "删除成功" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
