"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Clock, BarChart3, Send, RefreshCw, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";

export default function PracticeDetailPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const [practice, setPractice] = useState<any>(null);
  const [userTranslation, setUserTranslation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [startTime] = useState(Date.now());
  // 译文已完善
  const [isRefined, setIsRefined] = useState(false);
  const [savingToMemory, setSavingToMemory] = useState(false);
  // 提取术语
  const [showExtractTerm, setShowExtractTerm] = useState(false);
  const [termSource, setTermSource] = useState("");
  const [termTarget, setTermTarget] = useState("");
  // 参考记忆库
  const [showMemoryRef, setShowMemoryRef] = useState(false);
  const [memorySearch, setMemorySearch] = useState("");
  const [memoryRefs, setMemoryRefs] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/practice/${id}`).then(r => r.json()).then(setPractice);
  }, [id]);

  async function handleSubmit() {
    if (!userTranslation.trim()) return;
    setSubmitting(true);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const res = await fetch(`/api/practice/${id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userTranslation, timeSpent }),
    });
    const data = await res.json();
    setResult(data);
    setSubmitting(false);
    // Refresh practice to get latest submissions
    fetch(`/api/practice/${id}`).then(r => r.json()).then(setPractice);
  }

  // 存入记忆库
  async function handleSaveToMemory() {
    if (!result) return;
    setSavingToMemory(true);
    const res = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceText: practice.sourceText,
        targetText: userTranslation,
        sourceRef: practice.id,
        sourceType: "practice",
        rating: result.score.overallScore >= 80 ? 5 : result.score.overallScore >= 60 ? 3 : 2,
        notes: "来自翻译练习 — 译文已完善",
      }),
    });
    setSavingToMemory(false);
    if (res.ok) setIsRefined(true);
  }

  // 提取术语到术语库
  async function handleExtractTerm(e: React.FormEvent) {
    e.preventDefault();
    if (!termSource.trim() || !termTarget.trim()) return;
    await fetch("/api/glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceTerm: termSource, targetTerm: termTarget, visibility: "private" }),
    });
    setTermSource(""); setTermTarget(""); setShowExtractTerm(false);
  }

  // 搜索记忆库参考
  async function searchMemory() {
    if (!memorySearch.trim()) return;
    const res = await fetch(`/api/memory?search=${encodeURIComponent(memorySearch)}&limit=10`);
    if (res.ok) {
      const data = await res.json();
      setMemoryRefs(data.items || []);
    }
  }

  function getScoreColor(score: number) {
    if (score >= 85) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    if (score >= 50) return "text-orange-500";
    return "text-red-500";
  }

  function getScoreBg(score: number) {
    if (score >= 85) return "bg-green-50 border-green-200";
    if (score >= 70) return "bg-yellow-50 border-yellow-200";
    if (score >= 50) return "bg-orange-50 border-orange-200";
    return "bg-red-50 border-red-200";
  }

  if (!practice) {
    return <div className="text-center py-16 text-gray-400">加载中...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">{practice.title || "翻译练习"}</h2>

      {/* 原文 */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-700">📖 原文</h3>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
            {practice.sourceLang.toUpperCase()} → {practice.targetLang.toUpperCase()}
          </span>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{practice.sourceText}</p>
        </div>
      </div>

      {/* 翻译区 */}
      {!result && session && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">✍️ 你的译文</h3>
            <button onClick={() => setShowMemoryRef(!showMemoryRef)}
              className="text-xs text-accent-500 hover:underline flex items-center gap-1">
              🧠 {showMemoryRef ? "收起" : "参考记忆库"}
            </button>
          </div>

          {/* 记忆库参考面板 */}
          {showMemoryRef && (
            <div className="mb-4 p-4 bg-purple-50/50 rounded-lg border border-purple-100">
              <div className="flex gap-2 mb-3">
                <input value={memorySearch} onChange={(e) => setMemorySearch(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
                  placeholder="搜索记忆库中的类似翻译..."
                  onKeyDown={(e) => e.key === "Enter" && searchMemory()} />
                <button onClick={searchMemory} className="btn-primary text-xs">搜索</button>
              </div>
              {memoryRefs.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {memoryRefs.map((m: any) => (
                    <div key={m.id} className="p-2 bg-white rounded-lg text-sm">
                      <p className="text-gray-500 text-xs mb-1">{m.sourceText}</p>
                      <p className="text-gray-700 font-medium">{m.targetText}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">输入关键词搜索你的记忆库，作为翻译参考</p>
              )}
            </div>
          )}
          <textarea
            value={userTranslation}
            onChange={(e) => setUserTranslation(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300
              focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500
              text-sm min-h-40"
            placeholder="在这里输入你的翻译..."
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-400">
              用时: {Math.floor((Date.now() - startTime) / 60)}分{Math.floor((Date.now() - startTime) / 1000) % 60}秒
            </span>
            <button
              onClick={handleSubmit}
              disabled={!userTranslation.trim() || submitting}
              className="btn-primary flex items-center gap-2"
            >
              <Send size={16} />
              {submitting ? "评分中..." : "提交译文"}
            </button>
          </div>
        </div>
      )}

      {/* 评分结果 */}
      {result && (
        <div className={`card mb-6 border-2 ${getScoreBg(result.score.overallScore)}`}>
          <div className="text-center mb-6">
            <div className={`text-5xl font-bold ${getScoreColor(result.score.overallScore)}`}>
              {result.score.overallScore}
            </div>
            <p className="text-sm text-gray-500 mt-1">综合评分 / 100</p>
          </div>

          {/* 分数雷达 */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: "相似度", value: result.score.similarityScore, color: "blue" },
              { label: "术语一致性", value: result.score.terminologyScore, color: "purple" },
              { label: "流畅度", value: result.score.fluencyScore, color: "green" },
              { label: "完整性", value: result.score.completenessScore, color: "amber" },
            ].map((dim) => (
              <div key={dim.label} className="text-center p-3 bg-white rounded-lg">
                <div className={`text-xl font-bold text-${dim.color}-500`}>{dim.value}</div>
                <div className="text-xs text-gray-400">{dim.label}</div>
              </div>
            ))}
          </div>

          {/* 详细反馈 */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-600">💡 详细批改意见</h4>
            {(result.score.feedback || []).map((fb: any, i: number) => (
              <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-sm ${
                fb.severity === "error" ? "bg-red-50 text-red-700" :
                fb.severity === "warning" ? "bg-yellow-50 text-yellow-700" :
                "bg-blue-50 text-blue-700"
              }`}>
                {fb.severity === "error" ? <XCircle size={16} className="shrink-0 mt-0.5" /> :
                 fb.severity === "warning" ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> :
                 <Info size={16} className="shrink-0 mt-0.5" />}
                <div>
                  <span>{fb.message}</span>
                  {fb.suggestion && (
                    <span className="block mt-0.5 text-xs opacity-75">
                      建议: {fb.suggestion}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6 pt-4 border-t border-gray-200">
            {!isRefined ? (
              <button onClick={handleSaveToMemory} disabled={savingToMemory}
                className="btn-primary flex items-center gap-2 text-sm bg-purple-500 hover:bg-purple-600">
                <CheckCircle size={14} />
                {savingToMemory ? "保存中..." : "译文已完善，存入记忆库"}
              </button>
            ) : (
              <span className="flex items-center gap-1 text-sm text-purple-600 font-medium">
                <CheckCircle size={16} /> 已存入记忆库 ✅
              </span>
            )}
            <button onClick={() => { setShowExtractTerm(!showExtractTerm); setTermSource(""); setTermTarget(""); }}
              className="btn-secondary flex items-center gap-2 text-sm">
              📖 提取术语
            </button>
            <button onClick={() => { setResult(null); setUserTranslation(""); setIsRefined(false); }}
              className="btn-secondary flex items-center gap-2 text-sm ml-auto">
              <RefreshCw size={14} /> 重新翻译
            </button>
          </div>

          {/* 提取术语表单 */}
          {showExtractTerm && (
            <form onSubmit={handleExtractTerm} className="mt-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
              <p className="text-sm text-gray-600 mb-3">从译文中选取词汇或短语添加到术语库</p>
              <div className="flex items-center gap-3">
                <input value={termSource} onChange={(e) => setTermSource(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                  placeholder="源术语（如：due diligence）" required />
                <span className="text-gray-400">→</span>
                <input value={termTarget} onChange={(e) => setTermTarget(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                  placeholder="译文（如：尽职调查）" required />
                <button type="submit" className="btn-primary text-sm whitespace-nowrap">添加到术语库</button>
              </div>
              <p className="text-xs text-gray-400 mt-2">提示：选中译文中的词语复制粘贴到上方，手动配对原文术语</p>
            </form>
          )}
        </div>
      )}

      {/* 参考答案 */}
      {practice.referenceTranslation && (
        <div className="card mb-6">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-500" /> 参考答案
          </h3>
          <div className="p-4 bg-green-50/50 rounded-lg">
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">{practice.referenceTranslation}</p>
          </div>
        </div>
      )}

      {/* 历史提交 */}
      {practice.submissions?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-700 mb-4">📋 提交记录 ({practice.submissions.length})</h3>
          <div className="space-y-3">
            {practice.submissions.map((sub: any) => (
              <div key={sub.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    👤 {sub.user.displayName || sub.user.username}
                  </span>
                  {sub.score && (
                    <span className={`text-lg font-bold ${getScoreColor(sub.score.overallScore)}`}>
                      {sub.score.overallScore}分
                    </span>
                  )}
                </div>
                <p className="text-gray-700 text-sm">{sub.userTranslation}</p>
                {sub.timeSpent && (
                  <p className="text-xs text-gray-400 mt-1">⏱ 用时 {Math.floor(sub.timeSpent / 60)}分{sub.timeSpent % 60}秒</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 未登录提示 */}
      {!session && (
        <div className="card text-center py-12">
          <PenLineIcon />
          <p className="text-gray-500 mt-3">登录后即可提交翻译练习并获得评分</p>
        </div>
      )}
    </div>
  );
}

function PenLineIcon() {
  return (
    <svg className="mx-auto text-gray-300" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
    </svg>
  );
}
