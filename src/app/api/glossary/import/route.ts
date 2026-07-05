import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { glossaryService } from "@/lib/services/glossary.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const { terms } = await req.json();
    if (!Array.isArray(terms) || terms.length === 0) {
      return NextResponse.json({ error: "请提供要导入的术语" }, { status: 400 });
    }
    const result = await glossaryService.bulkImport(session.user.id, terms);
    return NextResponse.json({ ...result, message: `导入完成：新增 ${result.created}，跳过 ${result.skipped}` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
