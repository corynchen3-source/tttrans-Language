"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Plus, PenLine, Clock, BarChart3, Globe, Lock, Users } from "lucide-react";
import Link from "next/link";

export default function PracticePage() {
  const { data: session } = useSession();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // 创建表单
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [domain, setDomain] = useState("");
  const [visibility, setVisibility] = useState("private");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/practice?limit=20");
    if (res.ok) {
      const data = await res.json();
      setSessions(data.items || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceText.trim()) return;
    const res = await fetch("/api/practice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || "未命名练习",
        sourceText,
        referenceTranslation: referenceText || undefined,
        difficulty,
        domain: domain || undefined,
        visibility,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setTitle(""); setSourceText(""); setReferenceText("");
      fetchSessions();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">口笔译练习</h2>
        {session && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> 创建练习
          </button>
        )}
      </div>

      {/* 创建练习 */}
      {showCreate && (
        <div className="card mb-6">
          <h3 className="font-semibold text-gray-700 mb-4">新建翻译练习</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm
                focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              placeholder="练习标题（可选，如：法律合同翻译练习）" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">原文</label>
                <textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm
                    focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 h-36"
                  placeholder="输入要翻译的原文..." required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">参考译文（可选，用于评分对比）</label>
                <textarea value={referenceText} onChange={(e) => setReferenceText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm
                    focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 h-36"
                  placeholder="输入参考译文，用于机器评分..." />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm">
                <option value="beginner">🌱 初级</option>
                <option value="medium">🌿 中级</option>
                <option value="advanced">🌳 高级</option>
              </select>
              <input value={domain} onChange={(e) => setDomain(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm
                  focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                placeholder="领域（如：法律、医学）" />
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm">
                <option value="private">🔒 仅自己</option>
                <option value="team">👥 团队</option>
                <option value="public">🌐 公开</option>
              </select>
              <button type="submit" className="btn-primary text-sm whitespace-nowrap">创建练习</button>
            </div>
          </form>
        </div>
      )}

      {/* 练习列表 */}
      {sessions.length === 0 && !loading ? (
        <div className="card text-center py-16">
          <PenLine size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">暂无练习</p>
          <p className="text-gray-400 text-sm mt-1">
            {session ? "创建一个练习开始翻译吧" : "登录后可以创建翻译练习"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Link key={session.id} href={`/practice/${session.id}`}
              className="card hover:shadow-md transition-shadow block">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800">
                      {session.title || "未命名练习"}
                    </h3>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      session.difficulty === "beginner" ? "bg-green-50 text-green-600" :
                      session.difficulty === "advanced" ? "bg-red-50 text-red-600" :
                      "bg-yellow-50 text-yellow-600"
                    }`}>
                      {session.difficulty === "beginner" ? "初级" :
                       session.difficulty === "advanced" ? "高级" : "中级"}
                    </span>
                    {session.visibility === "public" && <Globe size={12} className="text-green-500" />}
                    {session.visibility === "private" && <Lock size={12} className="text-gray-400" />}
                    {session.visibility === "team" && <Users size={12} className="text-blue-500" />}
                  </div>
                  <p className="text-gray-500 text-sm line-clamp-2">{session.sourceText}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
                <span className="flex items-center gap-1"><PenLine size={12} /> {session.user.displayName || session.user.username}</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {new Date(session.createdAt).toLocaleDateString("zh-CN")}</span>
                <span className="flex items-center gap-1"><BarChart3 size={12} /> {session._count?.submissions || 0} 人练习</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
