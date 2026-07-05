"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Search, Plus, Brain, Star, Trash2, Edit3, FolderOpen, FolderPlus, X } from "lucide-react";

interface MemoryEntry {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  rating: number;
  tags: string;
  notes: string | null;
  sourceType: string | null;
  createdAt: string;
}

export default function MemoryPage() {
  const { data: session } = useSession();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 表单
  const [showCreate, setShowCreate] = useState(false);
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newRating, setNewRating] = useState(3);

  // 编辑
  const [editingEntry, setEditingEntry] = useState<MemoryEntry | null>(null);
  const [editSource, setEditSource] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editRating, setEditRating] = useState(3);

  // 记忆包
  const [collections, setCollections] = useState<any[]>([]);
  const [viewingPack, setViewingPack] = useState<any>(null);
  const [showNewPack, setShowNewPack] = useState(false);
  const [newPackName, setNewPackName] = useState("");
  const [newPackTags, setNewPackTags] = useState("");

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (search) params.set("search", search);
    const res = await fetch(`/api/memory?${params}`);
    const data = await res.json();
    setEntries(data.items || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { if (session) fetchEntries(); }, [fetchEntries, session]);

  const fetchCollections = useCallback(async () => {
    if (!session) return;
    const res = await fetch("/api/memory/collections");
    if (res.ok) setCollections(await res.json());
  }, [session]);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  // 记忆 CRUD
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newSource.trim() || !newTarget.trim()) return;
    const res = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceText: newSource, targetText: newTarget, notes: newNotes || undefined, rating: newRating }),
    });
    if (res.ok) {
      setNewSource(""); setNewTarget(""); setNewNotes(""); setNewRating(3);
      setShowCreate(false); fetchEntries();
      setMessage("已添加到记忆库 ✅"); setTimeout(() => setMessage(""), 3000);
    }
  }

  async function handleEdit(entry: MemoryEntry) {
    setEditingEntry(entry);
    setEditSource(entry.sourceText);
    setEditTarget(entry.targetText);
    setEditNotes(entry.notes || "");
    setEditRating(entry.rating);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEntry) return;
    const res = await fetch(`/api/memory/${editingEntry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceText: editSource, targetText: editTarget, notes: editNotes, rating: editRating }),
    });
    if (res.ok) { setEditingEntry(null); fetchEntries(); }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除这条记忆？")) return;
    await fetch(`/api/memory/${id}`, { method: "DELETE" });
    fetchEntries(); fetchCollections();
  }

  // 记忆包管理
  async function handleCreatePack(e: React.FormEvent) {
    e.preventDefault();
    if (!newPackName.trim()) return;
    const tags = newPackTags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
    await fetch("/api/memory/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPackName, tags }),
    });
    setNewPackName(""); setNewPackTags(""); setShowNewPack(false); fetchCollections();
    setMessage("记忆包创建成功 ✅"); setTimeout(() => setMessage(""), 3000);
  }

  async function handleDeletePack(id: string, name: string) {
    if (!confirm(`确定删除记忆包「${name}」？`)) return;
    await fetch(`/api/memory/collections/${id}`, { method: "DELETE" });
    if (viewingPack?.id === id) setViewingPack(null);
    fetchCollections();
  }

  async function openPack(col: any) {
    setViewingPack(col);
    const res = await fetch(`/api/memory/collections/${col.id}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data);
    }
  }

  const sourceLabel: Record<string, string> = { manual: "手动添加", corpus_import: "来自语料库", practice: "来自练习" };

  if (!session) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">记忆库</h2>
        <div className="card text-center py-16">
          <Brain size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">请先登录后查看你的记忆库</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">记忆库</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> 添加记忆
        </button>
      </div>

      {message && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">{message}</div>}

      {/* 添加记忆 */}
      {showCreate && (
        <div className="card mb-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">源文本</label>
                <textarea value={newSource} onChange={(e) => setNewSource(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-sm h-24" placeholder="输入原文..." required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">译文</label>
                <textarea value={newTarget} onChange={(e) => setNewTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-sm h-24" placeholder="输入译文..." required />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input value={newNotes} onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" placeholder="备注（可选）" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">评分:</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setNewRating(n)} className="p-0.5">
                    <Star size={18} className={n <= newRating ? "text-amber-400 fill-amber-400" : "text-gray-300"} />
                  </button>
                ))}
              </div>
              <button type="submit" className="btn-primary text-sm">保存</button>
            </div>
          </form>
        </div>
      )}

      {/* 记忆包管理 */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-700 flex items-center gap-2">
            <FolderOpen size={20} className="text-amber-500" /> 我的记忆包
            <span className="text-sm font-normal text-gray-400">({collections.length})</span>
          </h3>
          <button onClick={() => setShowNewPack(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <FolderPlus size={16} /> 新建记忆包
          </button>
        </div>

        {showNewPack && (
          <form onSubmit={handleCreatePack} className="flex items-center gap-3 mb-3 p-3 bg-amber-50/50 rounded-lg border border-amber-200">
            <input value={newPackName} onChange={(e) => setNewPackName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              placeholder="记忆包名称" required autoFocus />
            <input value={newPackTags} onChange={(e) => setNewPackTags(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              placeholder="标签（逗号分隔）" />
            <button type="submit" className="btn-primary text-sm">创建</button>
            <button type="button" onClick={() => setShowNewPack(false)} className="btn-secondary text-sm">取消</button>
          </form>
        )}

        {collections.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {collections.map((col: any) => (
              <div key={col.id}
                onClick={() => viewingPack?.id === col.id ? (setViewingPack(null), fetchEntries()) : openPack(col)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors group
                  ${viewingPack?.id === col.id ? "border-accent-500 bg-accent-50 text-accent-700 ring-2 ring-accent-200" : "border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/50"}`}>
                <FolderOpen size={14} className={viewingPack?.id === col.id ? "text-accent-500" : "text-amber-400"} />
                <span className="font-medium">{col.name}</span>
                <span className="text-xs text-gray-400">({col._count?.items || 0})</span>
                {col.tags && JSON.parse(col.tags || "[]").map((tag: string) => (
                  <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{tag}</span>
                ))}
                <button onClick={(e) => { e.stopPropagation(); handleDeletePack(col.id, col.name); }}
                  className="p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : !showNewPack && (
          <p className="text-sm text-gray-400">创建记忆包来分类管理你的译文记忆</p>
        )}
      </div>

      {/* 搜索 */}
      {!viewingPack && (
        <div className="relative mb-6">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索你的记忆库..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" />
        </div>
      )}

      {/* 记忆列表 */}
      {entries.length === 0 && !loading ? (
        <div className="card text-center py-16">
          <Brain size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">{viewingPack ? `记忆包「${viewingPack.name}」为空` : "记忆库为空"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="card hover:shadow-md transition-shadow">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 mb-2 inline-block">{entry.sourceLang.toUpperCase()}</span>
                  <p className="text-gray-800 text-sm mt-1">{entry.sourceText}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{entry.targetLang.toUpperCase()}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(entry)} className="p-1 rounded text-gray-400 hover:text-accent-500"><Edit3 size={14} /></button>
                      <button onClick={() => handleDelete(entry.id)} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm">{entry.targetText}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={12} className={n <= entry.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"} />
                  ))}
                </div>
                {entry.sourceType && <span>{sourceLabel[entry.sourceType] || entry.sourceType}</span>}
                {entry.notes && <span>📝 {entry.notes}</span>}
                <span className="ml-auto">{new Date(entry.createdAt).toLocaleDateString("zh-CN")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEditingEntry(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">编辑记忆</h3>
                <button onClick={() => setEditingEntry(null)} className="p-1"><X size={20} className="text-gray-400" /></button>
              </div>
              <form onSubmit={handleEditSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">源文本</label>
                    <textarea value={editSource} onChange={(e) => setEditSource(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 h-28" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">译文</label>
                    <textarea value={editTarget} onChange={(e) => setEditTarget(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 h-28" required />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" placeholder="备注" />
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setEditRating(n)} className="p-0.5">
                        <Star size={18} className={n <= editRating ? "text-amber-400 fill-amber-400" : "text-gray-300"} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setEditingEntry(null)} className="btn-secondary">取消</button>
                  <button type="submit" className="btn-primary">保存</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
