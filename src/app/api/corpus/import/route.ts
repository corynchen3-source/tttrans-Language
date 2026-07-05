import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { corpusService } from "@/lib/services/corpus.service";

export const dynamic = "force-dynamic";

/** 批量导入语料（JSON格式） */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { entries } = body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "请提供要导入的语料条目" }, { status: 400 });
    }

    if (entries.length > 5000) {
      return NextResponse.json({ error: "单次最多导入 5000 条" }, { status: 400 });
    }

    const result = await corpusService.bulkImport(session.user.id, entries);

    return NextResponse.json({
      ...result,
      message: `导入完成：新增 ${result.created} 条，跳过重复 ${result.skipped} 条`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "导入失败" }, { status: 500 });
  }
}
