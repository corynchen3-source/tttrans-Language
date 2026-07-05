import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const format = req.nextUrl.searchParams.get("format") || "srt";
  const bilingual = req.nextUrl.searchParams.get("bilingual") === "true";

  const project = await prisma.subtitleProject.findUnique({
    where: { id: params.id },
    include: { segments: { orderBy: { sequence: "asc" } } },
  });

  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  let content = "";
  const segs = project.segments;

  if (format === "srt") {
    content = segs.map((s, i) => {
      const start = formatSrtTime(s.startTime);
      const end = formatSrtTime(s.endTime);
      const text = bilingual && s.targetText
        ? `${s.sourceText}\n${s.targetText}`
        : s.targetText || s.sourceText;
      return `${i + 1}\n${start} --> ${end}\n${text}\n`;
    }).join("\n");
  } else if (format === "vtt") {
    content = "WEBVTT\n\n" + segs.map((s) => {
      const text = bilingual && s.targetText
        ? `${s.sourceText}\n${s.targetText}`
        : s.targetText || s.sourceText;
      return `${formatSrtTime(s.startTime).replace(",", ".")} --> ${formatSrtTime(s.endTime).replace(",", ".")}\n${text}\n`;
    }).join("\n");
  } else {
    // TXT
    content = segs.map((s) =>
      `${formatSrtTime(s.startTime)} - ${formatSrtTime(s.endTime)}\n${s.sourceText}\n${s.targetText || ""}\n`
    ).join("\n---\n");
  }

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.title || "subtitles"}.${format}"`,
    },
  });
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
