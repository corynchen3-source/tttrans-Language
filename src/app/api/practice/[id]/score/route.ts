import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreTranslation } from "@/lib/services/scoring.service";

export const dynamic = "force-dynamic";

/** 对已有提交重新评分 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { submissionId } = await req.json();
  const submission = await prisma.practiceSubmission.findUnique({
    where: { id: submissionId },
    include: { session: true },
  });

  if (!submission) return NextResponse.json({ error: "提交不存在" }, { status: 404 });

  const practice = submission.session;
  const result = scoreTranslation(
    practice.sourceText,
    submission.userTranslation,
    practice.referenceTranslation || "",
    (practice.targetLang as "en" | "zh") || "zh"
  );

  // Upsert score
  const score = await prisma.practiceScore.upsert({
    where: { submissionId },
    create: {
      submissionId,
      overallScore: result.overallScore,
      similarityScore: result.similarityScore,
      terminologyScore: result.terminologyScore,
      fluencyScore: result.fluencyScore,
      completeness: result.completenessScore,
      feedback: JSON.stringify(result.feedback),
      scoredBy: "machine",
    },
    update: {
      overallScore: result.overallScore,
      similarityScore: result.similarityScore,
      terminologyScore: result.terminologyScore,
      fluencyScore: result.fluencyScore,
      completeness: result.completenessScore,
      feedback: JSON.stringify(result.feedback),
    },
  });

  return NextResponse.json({ ...score, feedback: result.feedback });
}
