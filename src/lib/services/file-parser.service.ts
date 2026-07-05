import mammoth from "mammoth";
import * as XLSX from "xlsx";

async function getPdfParser() {
  const mod = await import("pdf-parse");
  return (mod as any).default || mod;
}

// ============================================================
// 类型
// ============================================================

interface BilingualPair {
  source: string;
  target: string;
  confidence: "high" | "medium" | "low";
  sourceLang: string;
  targetLang: string;
  /** 识别来源，用于调试 */
  origin?: string;
}

interface StrategyResult {
  pairs: BilingualPair[];
  /** 策略名称 */
  name: string;
  /** 高置信度配对数量 */
  highCount: number;
  /** 总配对数 */
  totalCount: number;
}

// ============================================================
// 语言检测
// ============================================================

function detectLanguage(text: string): "zh" | "en" | "mixed" {
  const cleaned = text.replace(/[\s\d!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]/g, "");
  if (cleaned.length === 0) return "en";
  const cjkCount = (cleaned.match(/[一-鿿㐀-䶿]/g) || []).length;
  const latinCount = (cleaned.match(/[a-zA-Z]/g) || []).length;
  const total = cjkCount + latinCount;
  if (total === 0) return "en";
  const cjkRatio = cjkCount / total;
  if (cjkRatio > 0.55) return "zh";
  if (cjkRatio < 0.15) return "en";
  return "mixed";
}

// ============================================================
// 文本提取
// ============================================================

/** DOCX：同时提取原始文本和HTML（用于表格检测） */
interface DocxExtraction {
  rawText: string;
  htmlTables: string[][][]; // [table][row][cell]
}

async function extractFromDocx(buffer: Buffer): Promise<DocxExtraction> {
  const [rawResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }),
  ]);

  const htmlTables = parseHtmlTables(htmlResult.value);

  return {
    rawText: rawResult.value,
    htmlTables,
  };
}

/** 从HTML中解析表格结构 */
function parseHtmlTables(html: string): string[][][] {
  const tables: string[][][] = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const rows: string[][] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableMatch[1])) !== null) {
      const cells: string[] = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        // 去除HTML标签
        const text = cellMatch[1].replace(/<[^>]+>/g, "").replace(/&[^;]+;/g, " ").trim();
        if (text) cells.push(text);
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) tables.push(rows);
  }

  return tables;
}

/** Excel：提取原始行数据 */
function extractFromXlsx(buffer: Buffer): string[][] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const allRows: string[][] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    for (const row of data) {
      const cells = row
        .map((cell) => (cell != null ? String(cell).trim() : ""))
        .filter((c) => c !== "");
      if (cells.length > 0) allRows.push(cells);
    }
  }

  return allRows;
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  const pdfParse = await getPdfParser();
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractFromTxt(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8");
}

// ============================================================
// 策略一：左右对照（表格双列 → 同行 EN+ZH 配对）
// ============================================================

/** 对表格行数据应用左右对照策略 */
function strategyTableColumns(rows: string[][]): StrategyResult {
  if (rows.length === 0) return { pairs: [], name: "左右对照（表格）", highCount: 0, totalCount: 0 };

  // 找出每列最多有多少个非空单元格
  const maxCols = Math.max(...rows.map((r) => r.length));

  // 如果列数 < 2，表格策略不适用
  if (maxCols < 2) return { pairs: [], name: "左右对照（表格）", highCount: 0, totalCount: 0 };

  // 找到最可能的 EN 列和 ZH 列
  const colScores: { enScore: number; zhScore: number }[] = [];
  for (let c = 0; c < maxCols; c++) {
    let enScore = 0, zhScore = 0, count = 0;
    for (const row of rows) {
      if (c < row.length && row[c]) {
        const lang = detectLanguage(row[c]);
        if (lang === "en") enScore++;
        else if (lang === "zh") zhScore++;
        count++;
      }
    }
    colScores.push({
      enScore: count > 0 ? enScore / count : 0,
      zhScore: count > 0 ? zhScore / count : 0,
    });
  }

  // 选 EN 特征最强的列和 ZH 特征最强的列
  let enCol = -1, zhCol = -1;
  let bestEn = 0, bestZh = 0;
  for (let c = 0; c < colScores.length; c++) {
    if (colScores[c].enScore > bestEn) { bestEn = colScores[c].enScore; enCol = c; }
    if (colScores[c].zhScore > bestZh) { bestZh = colScores[c].zhScore; zhCol = c; }
  }

  // 必须找到不同的 EN 和 ZH 列
  if (enCol === -1 || zhCol === -1 || enCol === zhCol) {
    return { pairs: [], name: "左右对照（表格）", highCount: 0, totalCount: 0 };
  }

  // 配对
  const pairs: BilingualPair[] = [];
  for (const row of rows) {
    const src = row[enCol]?.trim();
    const tgt = row[zhCol]?.trim();
    if (!src || !tgt) continue;
    // 双向确认
    const srcLang = detectLanguage(src);
    const tgtLang = detectLanguage(tgt);
    const confidence =
      srcLang === "en" && tgtLang === "zh" ? "high" :
      (srcLang === "zh" && tgtLang === "en") ? "high" : "medium";

    pairs.push({
      source: (srcLang === "zh" && tgtLang === "en") ? tgt : src,
      target: (srcLang === "zh" && tgtLang === "en") ? src : tgt,
      confidence,
      sourceLang: "en",
      targetLang: "zh",
      origin: `列${enCol + 1}→列${zhCol + 1}`,
    });
  }

  const highCount = pairs.filter((p) => p.confidence === "high").length;
  return { pairs, name: "左右对照（表格）", highCount, totalCount: pairs.length };
}

// ============================================================
// 策略二：上下对照 — 逐行配对（EN ZH 交替行）
// ============================================================

/**
 * 核心配对逻辑：从已标注语言的片段中配对相邻的双语片段
 * 支持单行交替和多行块交替
 */
function pairLabeledSegments(
  labeled: { text: string; lang: string }[],
  originName: string
): BilingualPair[] {
  const pairs: BilingualPair[] = [];
  let i = 0;

  while (i < labeled.length - 1) {
    const curr = labeled[i];
    const next = labeled[i + 1];

    if (curr.lang === "en" && (next.lang === "zh" || next.lang === "mixed")) {
      pairs.push({
        source: curr.text, target: next.text,
        confidence: next.lang === "zh" ? "high" : "medium",
        sourceLang: "en", targetLang: "zh",
        origin: originName,
      });
      i += 2;
    } else if ((curr.lang === "zh" || curr.lang === "mixed") && next.lang === "en") {
      pairs.push({
        source: next.text, target: curr.text,
        confidence: curr.lang === "zh" ? "high" : "medium",
        sourceLang: "en", targetLang: "zh",
        origin: originName,
      });
      i += 2;
    } else {
      i++;
    }
  }

  return pairs;
}

/** 逐行配对：按单行分割，相邻不同语言的行配对 */
function strategyLineByLine(lines: string[]): StrategyResult {
  // 过滤掉太短的行和纯空白行
  const labeled = lines
    .map((text) => ({ text: text.trim(), lang: detectLanguage(text.trim()) }))
    .filter((s) => s.text.length > 2);

  const pairs = pairLabeledSegments(labeled, "逐行对照");

  const highCount = pairs.filter((p) => p.confidence === "high").length;
  return { pairs, name: "上下对照（逐行）", highCount, totalCount: pairs.length };
}

/** 段落配对：按双换行分割，相邻段落配对（适用于长段落对照） */
function strategyAlternatingParagraphs(segments: string[]): StrategyResult {
  // 注意：段落可能包含多行（EN段和ZH段用双换行隔开）
  const labeled = segments
    .map((text) => ({ text, lang: detectLanguage(text) }))
    .filter((s) => s.lang !== "mixed" || s.text.length > 15);

  const pairs = pairLabeledSegments(labeled, "段落对照");

  const highCount = pairs.filter((p) => p.confidence === "high").length;
  return { pairs, name: "上下对照（段落）", highCount, totalCount: pairs.length };
}

// ============================================================
// 策略三：冒号引导分隔（"EN":"ZH" 或 "ZH":"EN"）
// ============================================================

function strategyColonQuoted(lines: string[]): StrategyResult {
  const pairs: BilingualPair[] = [];

  // 匹配 "text" : "text" (中文或英文冒号，可选空格)
  const quotedPattern = /["""]([^"""]+)["""]\s*[：:]\s*["""]([^"""]+)["""]/;
  // 匹配无引号的 text:text
  const plainPattern = /^([^：:\t,，]+)\s*[：:]\s*(.+)$/;

  let quoteMatchCount = 0;
  let plainMatchCount = 0;

  for (const line of lines) {
    if (quotedPattern.test(line)) quoteMatchCount++;
    else if (plainPattern.test(line)) plainMatchCount++;
  }

  // 选择匹配数更多的模式
  const useQuoted = quoteMatchCount >= plainMatchCount && quoteMatchCount > 0;
  const usePlain = plainMatchCount > quoteMatchCount && plainMatchCount > 0;

  if (!useQuoted && !usePlain) {
    return { pairs: [], name: "冒号分隔", highCount: 0, totalCount: 0 };
  }

  for (const line of lines) {
    let left = "", right = "";

    if (useQuoted) {
      const m = line.match(quotedPattern);
      if (m) { left = m[1].trim(); right = m[2].trim(); }
      else continue;
    } else {
      const m = line.match(plainPattern);
      if (m) { left = m[1].trim(); right = m[2].trim(); }
      else continue;
    }

    if (!left || !right) continue;

    const leftLang = detectLanguage(left);
    const rightLang = detectLanguage(right);

    // EN:ZH → source:target
    if (leftLang === "en" && (rightLang === "zh" || rightLang === "mixed")) {
      pairs.push({
        source: left, target: right,
        confidence: rightLang === "zh" ? "high" : "medium",
        sourceLang: "en", targetLang: "zh",
        origin: "冒号分隔",
      });
    }
    // ZH:EN → reverse
    else if ((leftLang === "zh" || leftLang === "mixed") && rightLang === "en") {
      pairs.push({
        source: right, target: left,
        confidence: leftLang === "zh" ? "high" : "medium",
        sourceLang: "en", targetLang: "zh",
        origin: "冒号分隔",
      });
    }
  }

  const highCount = pairs.filter((p) => p.confidence === "high").length;
  return { pairs, name: "冒号分隔", highCount, totalCount: pairs.length };
}

// ============================================================
// 策略四：行内分隔符（Tab/逗号 → 同行左右对照）
// ============================================================

function strategyInlineDelimiter(lines: string[]): StrategyResult {
  const pairs: BilingualPair[] = [];
  const delimiterPatterns = [/\t/, /\s{3,}/, /(?<!\d)[,，](?!\d)/, /[;；]/];

  let bestDelimiter: RegExp | null = null;
  let bestSplitCount = 0;

  // 自动检测最佳分隔符
  for (const pattern of delimiterPatterns) {
    let count = 0;
    for (const line of lines) {
      const parts = line.split(pattern).filter((s) => s.trim());
      if (parts.length >= 2) count++;
    }
    if (count > bestSplitCount) {
      bestSplitCount = count;
      bestDelimiter = pattern;
    }
  }

  if (!bestDelimiter || bestSplitCount < lines.length * 0.3) {
    return { pairs: [], name: "行内分隔符", highCount: 0, totalCount: 0 };
  }

  for (const line of lines) {
    const parts = line.split(bestDelimiter).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const a = parts[0], b = parts[1];
    const aLang = detectLanguage(a), bLang = detectLanguage(b);
    const confidence =
      (aLang === "en" && bLang === "zh") || (aLang === "zh" && bLang === "en") ? "high" : "medium";
    pairs.push({
      source: aLang === "zh" && bLang === "en" ? b : a,
      target: aLang === "zh" && bLang === "en" ? a : b,
      confidence, sourceLang: "en", targetLang: "zh",
      origin: "行内分隔符",
    });
  }

  const highCount = pairs.filter((p) => p.confidence === "high").length;
  return { pairs, name: "行内分隔符", highCount, totalCount: pairs.length };
}

// ============================================================
// 策略四：表格行上下对照（单列多行 → 交替配对）
// ============================================================

function strategyTableRows(rows: string[][]): StrategyResult {
  // 只适用于单列表格
  if (rows.length < 2) return { pairs: [], name: "上下对照（单列表格）", highCount: 0, totalCount: 0 };

  const singleColSegments: string[] = [];
  for (const row of rows) {
    if (row.length === 1 && row[0].length > 3) {
      singleColSegments.push(row[0]);
    } else if (row.length >= 2) {
      // 多列表格 → 不适合此策略
      return { pairs: [], name: "上下对照（单列表格）", highCount: 0, totalCount: 0 };
    }
  }

  if (singleColSegments.length < 2) {
    return { pairs: [], name: "上下对照（单列表格）", highCount: 0, totalCount: 0 };
  }

  const result = strategyAlternatingParagraphs(singleColSegments);
  result.name = "上下对照（单列表格）";
  return result;
}

// ============================================================
// 智能策略选择器
// ============================================================

function selectBestStrategy(results: StrategyResult[]): BilingualPair[] {
  // 优先选高置信度数量最多的
  results.sort((a, b) => {
    if (b.highCount !== a.highCount) return b.highCount - a.highCount;
    return b.totalCount - a.totalCount;
  });

  const best = results[0];
  if (!best || best.totalCount === 0) return [];

  // 如果最佳策略的高置信度明显领先，独用该策略
  // 如果多种策略都有不错的产出，合并去重
  const threshold = best.highCount * 0.7;
  const candidates = results.filter((r) => r.highCount >= threshold && r.totalCount > 0);

  if (candidates.length === 1) {
    return best.pairs.map((p) => ({ ...p, confidence: p.confidence }));
  }

  // 合并多种策略的结果，按源文本去重
  const seen = new Set<string>();
  const merged: BilingualPair[] = [];

  // 先加高置信度的
  for (const result of candidates) {
    for (const pair of result.pairs) {
      const key = `${pair.source.slice(0, 80)}|${pair.target.slice(0, 80)}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(pair);
      }
    }
  }

  return merged;
}

function collectSegments(text: string): string[] {
  return text
    .split(/\n\n+|\r\n\r\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function collectLines(text: string): string[] {
  return text
    .split(/\n|\r\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

// ============================================================
// 主入口
// ============================================================

export interface ParseResult {
  pairs: BilingualPair[];
  rawText: string;
  totalSegments: number;
  fileType: string;
  layoutDetected: string;
}

export async function parseFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ParseResult> {
  const ext = fileName.split(".").pop()?.toLowerCase();
  let rawText = "";
  let allResults: StrategyResult[] = [];

  // ── DOCX ──
  if (ext === "docx" || mimeType.includes("wordprocessingml")) {
    const { rawText: txt, htmlTables } = await extractFromDocx(buffer);
    rawText = txt;

    // 策略A: HTML表格 → 左右对照
    if (htmlTables.length > 0) {
      for (const table of htmlTables) {
        allResults.push(strategyTableColumns(table));
        allResults.push(strategyTableRows(table));
      }
    }

    // 策略B: 逐行 → 上下对照（最常见）
    const lines = collectLines(rawText);
    allResults.push(strategyLineByLine(lines));

    // 策略C: 段落 → 上下对照
    allResults.push(strategyAlternatingParagraphs(collectSegments(rawText)));

    // 策略D: 逐行分隔符
    allResults.push(strategyColonQuoted(lines));
    allResults.push(strategyInlineDelimiter(lines));
  }

  // ── XLSX ──
  else if (ext === "xlsx" || ext === "xls" || mimeType.includes("spreadsheetml")) {
    const rows = extractFromXlsx(buffer);
    rawText = rows.map((r) => r.join("\t")).join("\n");

    const lines = collectLines(rawText);
    allResults.push(strategyTableColumns(rows));
    allResults.push(strategyTableRows(rows));
    allResults.push(strategyLineByLine(lines));
    allResults.push(strategyAlternatingParagraphs(rows.map((r) => r.join(" "))));
    allResults.push(strategyInlineDelimiter(rows.map((r) => r.join("\t"))));
  }

  // ── PDF / TXT / CSV ──
  else if (ext === "pdf" || mimeType.includes("pdf")) {
    rawText = await extractFromPdf(buffer);
    const lines = collectLines(rawText);
    allResults.push(strategyLineByLine(lines));
    allResults.push(strategyAlternatingParagraphs(collectSegments(rawText)));
    allResults.push(strategyColonQuoted(lines));
    allResults.push(strategyInlineDelimiter(lines));
  }

  else if (ext === "txt" || ext === "csv" || mimeType.includes("text") || mimeType.includes("csv")) {
    rawText = await extractFromTxt(buffer);
    const lines = collectLines(rawText);
    allResults.push(strategyLineByLine(lines));
    allResults.push(strategyAlternatingParagraphs(collectSegments(rawText)));
    allResults.push(strategyColonQuoted(lines));
    allResults.push(strategyInlineDelimiter(lines));

    // CSV: 也用表格策略试试
    if (ext === "csv") {
      const rows = rawText.split(/\n/).map((line) => line.split(/[,\t]/).map((s) => s.trim()).filter(Boolean));
      allResults.push(strategyTableColumns(rows));
    }
  }

  else {
    throw new Error(`不支持的文件格式: .${ext}，请使用 Word/Excel/PDF/TXT/CSV`);
  }

  if (!rawText.trim()) {
    throw new Error("未能从文件中提取到文本内容，请检查文件是否正确");
  }

  // 选择最佳策略
  const pairs = selectBestStrategy(allResults);

  // 确定布局类型
  const bestResult = allResults.sort((a, b) => b.highCount - a.highCount)[0];
  const layoutDetected = bestResult?.name || "未知";

  return {
    pairs,
    rawText: rawText.slice(0, 5000),
    totalSegments: collectSegments(rawText).length,
    fileType: ext || "unknown",
    layoutDetected,
  };
}
