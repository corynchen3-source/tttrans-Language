import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreTranslation } from "@/lib/services/scoring.service";

export const dynamic = "force-dynamic";

/** 提交翻译 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json();
  const practice = await prisma.practiceSession.findUnique({ where: { id: params.id } });
  if (!practice) return NextResponse.json({ error: "练习不存在" }, { status: 404 });

  // 保存提交
  const submission = await prisma.practiceSubmission.create({
    data: {
      sessionId: params.id,
      userId: session.user.id,
      userTranslation: body.userTranslation,
      timeSpent: body.timeSpent,
    },
  });

  // 自动评分
  const scoreResult = scoreTranslation(
    practice.sourceText,
    body.userTranslation,
    practice.referenceTranslation || "",
    (practice.targetLang as "en" | "zh") || "zh"
  );

  const score = await prisma.practiceScore.create({
    data: {
      submissionId: submission.id,
      overallScore: scoreResult.overallScore,
      similarityScore: scoreResult.similarityScore,
      terminologyScore: scoreResult.terminologyScore,
      fluencyScore: scoreResult.fluencyScore,
      completeness: scoreResult.completenessScore,
      feedback: JSON.stringify(scoreResult.feedback),
      scoredBy: "machine",
    },
  });

  return NextResponse.json({
    submission,
    score: { ...score, feedback: scoreResult.feedback },
  }, { status: 201 });
}
