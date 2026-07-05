import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 批量添加/更新字幕段落 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { segments } = await req.json();

  // 删除旧段落
  await prisma.subtitleSegment.deleteMany({ where: { projectId: params.id } });

  // 批量创建新段落
  const created = await Promise.all(
    segments.map((seg: any, i: number) =>
      prisma.subtitleSegment.create({
        data: {
          projectId: params.id,
          sequence: i + 1,
          startTime: seg.startTime,
          endTime: seg.endTime,
          sourceText: seg.sourceText,
          targetText: seg.targetText || "",
        },
      })
    )
  );

  return NextResponse.json(created);
}

/** 更新单条段落 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { segmentId, sourceText, targetText } = await req.json();

  const updated = await prisma.subtitleSegment.update({
    where: { id: segmentId },
    data: { sourceText, targetText, isEdited: true },
  });

  return NextResponse.json(updated);
}

/** 将字幕段落添加到语料库 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { segmentId } = await req.json();
  const seg = await prisma.subtitleSegment.findUnique({ where: { id: segmentId } });
  if (!seg) return NextResponse.json({ error: "段落不存在" }, { status: 404 });

  // 添加到语料库
  const hash = require("crypto").createHash("sha256")
    .update(`${seg.sourceText.trim().toLowerCase()}|||${(seg.targetText || "").trim().toLowerCase()}`)
    .digest("hex");

  const existing = await prisma.corpusEntry.findUnique({ where: { contentHash: hash } });
  if (existing) return NextResponse.json({ message: "该语料已存在", isNew: false });

  await prisma.corpusEntry.create({
    data: {
      ownerId: session.user.id,
      sourceText: seg.sourceText,
      targetText: seg.targetText || "",
      contentHash: hash,
      visibility: "private",
      metadata: JSON.stringify({ importedFrom: "subtitle", segmentId }),
    },
  });

  return NextResponse.json({ message: "已添加到语料库 ✅", isNew: true });
}
