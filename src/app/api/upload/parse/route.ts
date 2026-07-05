import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseFile } from "@/lib/services/file-parser.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请选择要上传的文件" }, { status: 400 });
    }

    // 校验文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "文件大小不能超过 10MB" }, { status: 400 });
    }

    // 校验文件类型
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",       // .xlsx
      "application/vnd.ms-excel",                                                 // .xls
      "application/pdf",                                                          // .pdf
      "text/plain",                                                               // .txt
      "text/csv",                                                                 // .csv
      "application/vnd.ms-excel.sheet.macroEnabled.12",                           // .xlsm
    ];

    const isAllowed = allowedTypes.includes(file.type) ||
      /\.(docx|xlsx|xls|pdf|txt|csv)$/i.test(file.name);

    if (!isAllowed) {
      return NextResponse.json({
        error: "不支持的文件格式，请上传 Word(.docx)、Excel(.xlsx/.xls)、PDF、TXT 或 CSV 文件",
      }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await parseFile(buffer, file.name, file.type);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      ...result,
    });
  } catch (e: any) {
    console.error("文件解析失败:", e);
    return NextResponse.json({
      error: e.message || "文件解析失败，请检查文件格式",
    }, { status: 500 });
  }
}
