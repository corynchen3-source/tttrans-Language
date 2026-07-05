// ============================================================
// 翻译练习评分引擎
// ============================================================

interface ScoreBreakdown {
  overall: number;
  similarity: number;
  terminology: number;
  fluency: number;
  completeness: number;
}

interface FeedbackItem {
  category: "similarity" | "terminology" | "fluency" | "completeness";
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
}

interface ScoringResult {
  overallScore: number;
  similarityScore: number;
  terminologyScore: number;
  fluencyScore: number;
  completenessScore: number;
  feedback: FeedbackItem[];
}

// ============================================================
// 分词工具（中英文混合分词）
// ============================================================

function tokenize(text: string, lang: "en" | "zh"): string[] {
  if (lang === "en") {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0);
  }
  // 中文：按字符+词组分
  const cleaned = text.replace(/[^一-鿿\w]/g, " ");
  // 简单双字词+单字
  const chars = cleaned.replace(/\s/g, "").split("");
  const bigrams: string[] = [];
  for (let i = 0; i < chars.length - 1; i++) {
    bigrams.push(chars[i] + chars[i + 1]);
  }
  return [...chars, ...bigrams];
}

// ============================================================
// 1. 相似度评分 (0-100)
// ============================================================

function scoreSimilarity(userTranslation: string, reference: string, lang: "en" | "zh"): number {
  if (!reference.trim()) return 75; // 无参考译文，默认中上分

  const userTokens = tokenize(userTranslation, lang);
  const refTokens = tokenize(reference, lang);

  if (refTokens.length === 0) return 75;

  const refSet = new Set(refTokens);
  const overlap = userTokens.filter((t) => refSet.has(t)).length;

  // Jaccard-like similarity
  const union = new Set(userTokens.concat(refTokens)).size;
  const score = (overlap / union) * 100;

  return Math.min(100, Math.round(score * 1.5)); // 放大系数，让学生更有成就感
}

// ============================================================
// 2. 术语一致性评分 (0-100)
// ============================================================

function scoreTerminology(
  userTranslation: string,
  sourceText: string,
  _reference: string,
  glossaryTerms?: { source: string; target: string }[]
): { score: number; feedback: FeedbackItem[] } {
  const feedback: FeedbackItem[] = [];

  if (!glossaryTerms || glossaryTerms.length === 0) {
    return { score: 85, feedback: [{ category: "terminology", severity: "info", message: "未提供术语库参考，术语评分基于默认标准" }] };
  }

  let matched = 0;
  let total = 0;

  for (const term of glossaryTerms) {
    if (sourceText.toLowerCase().includes(term.source.toLowerCase())) {
      total++;
      if (userTranslation.includes(term.target)) {
        matched++;
      } else {
        feedback.push({
          category: "terminology",
          severity: "warning",
          message: `术语「${term.source}」建议译为「${term.target}」，但未在译文中找到`,
          suggestion: term.target,
        });
      }
    }
  }

  const score = total > 0 ? Math.round((matched / total) * 100) : 85;

  if (matched > 0 && matched === total) {
    feedback.push({ category: "terminology", severity: "info", message: `术语使用正确 (${matched}/${total}) 👍` });
  }

  return { score, feedback };
}

// ============================================================
// 3. 流畅度评分 (0-100)
// ============================================================

function scoreFluency(text: string, lang: "en" | "zh"): { score: number; feedback: FeedbackItem[] } {
  const feedback: FeedbackItem[] = [];
  let score = 80; // 基础分
  const issues: string[] = [];

  if (lang === "zh") {
    // 检查过长的句子（中文超过80字可能过于复杂）
    const sentences = text.split(/[。！？\n]/).filter((s) => s.trim());
    for (const s of sentences) {
      if (s.length > 80) {
        score -= 5;
        issues.push("存在过长句子，建议拆分以提高可读性");
        break;
      }
    }

    // 检查西式被动语态（"被"字过多）
    const beiCount = (text.match(/被/g) || []).length;
    const charCount = text.replace(/\s/g, "").length;
    if (charCount > 0 && beiCount / charCount > 0.02) {
      score -= 8;
      issues.push("「被」字使用偏多，中文可考虑用「受」「遭」「由」等替代或省略被动语态");
    }

    // 检查欧化表达"的"字过多
    const deCount = (text.match(/的/g) || []).length;
    if (charCount > 0 && deCount / charCount > 0.06) {
      score -= 5;
      issues.push("「的」字使用偏多，可能受英文定语从句影响");
    }
  } else {
    // 英文流畅度
    const words = text.split(/\s+/);
    if (words.length < 2) {
      score -= 10;
      issues.push("译文过短，可能未完整翻译");
    }
  }

  score = Math.max(40, Math.min(100, score));

  for (const issue of issues) {
    feedback.push({ category: "fluency", severity: "warning", message: issue });
  }

  if (issues.length === 0) {
    feedback.push({ category: "fluency", severity: "info", message: lang === "zh" ? "中文表达流畅" : "英文表达流畅" });
  }

  return { score, feedback };
}

// ============================================================
// 4. 完整性评分 (0-100)
// ============================================================

function scoreCompleteness(userTranslation: string, sourceText: string): { score: number; feedback: FeedbackItem[] } {
  const feedback: FeedbackItem[] = [];
  let score = 100;

  // 长度比检查
  const srcLen = sourceText.replace(/\s/g, "").length;
  const tgtLen = userTranslation.replace(/\s/g, "").length;

  if (srcLen === 0) return { score: 100, feedback: [] };

  const ratio = tgtLen / srcLen;

  // 中英长度比合理范围：中文约为英文的0.6-0.9
  if (ratio < 0.3) {
    score -= 30;
    feedback.push({ category: "completeness", severity: "error", message: "译文明显短于原文，可能有大量内容未翻译" });
  } else if (ratio < 0.5) {
    score -= 15;
    feedback.push({ category: "completeness", severity: "warning", message: "译文偏短，请检查是否有遗漏的内容" });
  } else if (ratio > 1.5) {
    score -= 10;
    feedback.push({ category: "completeness", severity: "warning", message: "译文明显长于原文，可能有冗余或过度翻译" });
  }

  // 检查段落/句号数量匹配
  const srcSentences = sourceText.split(/[.!?。！？\n]+/).filter((s) => s.trim()).length;
  const tgtSentences = userTranslation.split(/[.!?。！？\n]+/).filter((s) => s.trim()).length;

  if (srcSentences > 5 && Math.abs(srcSentences - tgtSentences) > srcSentences * 0.4) {
    score -= 10;
    feedback.push({
      category: "completeness", severity: "warning",
      message: `原文约${srcSentences}句，译文约${tgtSentences}句，句子数量差异较大`,
    });
  }

  score = Math.max(30, Math.min(100, score));

  if (score >= 90) {
    feedback.push({ category: "completeness", severity: "info", message: "译文长度与原文匹配良好 ✅" });
  }

  return { score, feedback };
}

// ============================================================
// 综合评分
// ============================================================

export function scoreTranslation(
  sourceText: string,
  userTranslation: string,
  referenceTranslation: string,
  targetLang: "en" | "zh" = "zh",
  glossaryTerms?: { source: string; target: string }[]
): ScoringResult {
  // 各维度评分（权重不同）
  const similarity = scoreSimilarity(userTranslation, referenceTranslation, targetLang);
  const termResult = scoreTerminology(userTranslation, sourceText, referenceTranslation, glossaryTerms);
  const fluencyResult = scoreFluency(userTranslation, targetLang);
  const completenessResult = scoreCompleteness(userTranslation, sourceText);

  // 加权综合分
  const overall = Math.round(
    similarity * 0.35 +
    termResult.score * 0.25 +
    fluencyResult.score * 0.20 +
    completenessResult.score * 0.20
  );

  // 收集所有反馈
  const feedback: FeedbackItem[] = [
    ...completenessResult.feedback,
    ...fluencyResult.feedback,
    ...termResult.feedback,
  ];

  // 总体评价
  if (overall >= 90) {
    feedback.unshift({ category: "similarity", severity: "info", message: "🌟 优秀！译文质量很高，与参考译文高度一致" });
  } else if (overall >= 75) {
    feedback.unshift({ category: "similarity", severity: "info", message: "👍 良好！译文整体质量不错，还有提升空间" });
  } else if (overall >= 60) {
    feedback.unshift({ category: "similarity", severity: "warning", message: "📝 及格，建议对照参考译文改进用词和表达" });
  } else {
    feedback.unshift({ category: "similarity", severity: "error", message: "🔧 需要加强，建议仔细对比参考译文重新练习" });
  }

  return {
    overallScore: overall,
    similarityScore: similarity,
    terminologyScore: termResult.score,
    fluencyScore: fluencyResult.score,
    completenessScore: completenessResult.score,
    feedback,
  };
}

// ============================================================
// 提取源文本中的术语提示
// ============================================================

export function extractTermHints(sourceText: string): string[] {
  // 提取可能为术语的单词/短语（大写开头、引号内、专业词汇等）
  const hints: string[] = [];

  // 大写开头的短语
  const caps = sourceText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
  if (caps) hints.push(...caps);

  // 引号内的内容
  const quoted = sourceText.match(/[""]([^""]+)[""]/g);
  if (quoted) hints.push(...quoted.map((q) => q.replace(/[""]/g, "")));

  return Array.from(new Set(hints)).slice(0, 10);
}
