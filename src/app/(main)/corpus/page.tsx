"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Search, Plus, BookOpen, Download, Globe, Lock, Users, Brain, Upload, FileText, FolderOpen, FolderPlus, Tag, X, ChevronDown, ChevronRight, Edit3, Trash2 } from "lucide-react";
import Link from "next/link";

interface CorpusEntry {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  domain: string | null;
  visibility: string;
  upvoteCount: number;
  usageCount: number;
  createdAt: string;
  owner: { id: string; username: string; displayName: string | null };
}

export default function CorpusPage() {
  const { data: session } = useSession();
  const [entries, setEntries] = useState<CorpusEntry[]>([]);
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // 新增表单
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newVisibility, setNewVisibility] = useState("private");
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsedPairs, setParsedPairs] = useState<any[]>([]);
  const [selectedPairs, setSelectedPairs] = useState<Set<number>>(new Set());
  const [importDomain, setImportDomain] = useState("");
  const [importVisibility, setImportVisibility] = useState("private");

  // 文件夹管理
  const [collections, setCollections] = useState<any[]>([]);
  const [showFolderPanel, setShowFolderPanel] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderTags, setNewFolderTags] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [showFolderSelect, setShowFolderSelect] = useState(false);
  const [viewingPack, setViewingPack] = useState<any>(null); // 当前查看的语料包
  const [packEntries, setPackEntries] = useState<CorpusEntry[]>([]);
  const [packCursor, setPackCursor] = useState<string | null>(null);

  // 编辑状态
  const [editingEntry, setEditingEntry] = useState<CorpusEntry | null>(null);
  const [editSource, setEditSource] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [editVisibility, setEditVisibility] = useState("");

  // 导入结果
  const [importResult, setImportResult] = useState<string | null>(null);

  const fetchEntries = useCallback(
    async (reset = false) => {
      setLoading(true);
      const params = new URLSearchParams({ limit: "20" });
      if (search) params.set("search", search);
      if (domain) params.set("domain", domain);
      if (!reset && cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/corpus?${params}`);
      const data = await res.json();

      if (reset) {
        setEntries(data.items);
      } else {
        setEntries((prev) => [...prev, ...data.items]);
      }
      setCursor(data.nextCursor || null);
      setHasMore(data.hasMore);
      setLoading(false);
    },
    [search, domain, cursor]
  );

  useEffect(() => {
    fetchEntries(true);
  }, [search, domain]);

  // 获取统计
  useEffect(() => {
    fetch("/api/corpus?limit=1").then((res) => res.json()).then((data) => {
      // 简单统计
      setStats({ total: data.items?.length ? "..." : "0" });
    });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newSource.trim() || !newTarget.trim()) return;

    const res = await fetch("/api/corpus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceText: newSource,
        targetText: newTarget,
        domain: newDomain || undefined,
        visibility: newVisibility,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setNewSource("");
      setNewTarget("");
      setNewDomain("");
      setShowCreate(false);
      fetchEntries(true);
      if (!data.isNew) {
        setImportResult("该语料已存在，已自动跳过重复");
        setTimeout(() => setImportResult(null), 3000);
      }
    }
  }

  async function handleImportToMine(entryId: string) {
    if (!session) return;
    const res = await fetch(`/api/corpus/${entryId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      const messages: Record<string, string> = {
        created: "已添加到你的语料库 ✅",
        merged: `已合并！补充了 ${data.addedTranslations?.length || 0} 个缺失译文 ✅`,
        skipped: "该语料已在你库中，无需重复添加",
      };
      setImportResult(messages[data.action] || "操作成功");
      setTimeout(() => setImportResult(null), 3000);
    }
  }

  async function handleSaveToMemory(entryId: string) {
    if (!session) return;
    const res = await fetch(`/api/memory/${entryId}`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok) {
      setImportResult(data.isNew ? "已存入记忆库 ✅" : "已在记忆库中，无需重复添加");
      setTimeout(() => setImportResult(null), 3000);
    }
  }

  // 文件上传解析
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload/parse", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (res.ok) {
      setParsedPairs(data.pairs || []);
      setSelectedPairs(new Set((data.pairs || []).map((_: any, i: number) => i)));
      setImportResult(`检测到排版模式: ${data.layoutDetected || "自动识别"}，共 ${data.pairs?.length || 0} 对`);
      setTimeout(() => setImportResult(null), 4000);
    } else {
      setImportResult("❌ " + data.error);
      setTimeout(() => setImportResult(null), 4000);
    }
    e.target.value = "";
  }

  // 确认导入选中配对
  async function handleConfirmImport() {
    const toImport = parsedPairs.filter((_, i) => selectedPairs.has(i));
    if (toImport.length === 0) return;
    setUploading(true);
    const res = await fetch("/api/corpus/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: toImport.map((p: any) => ({
          sourceText: p.source,
          targetText: p.target,
          domain: importDomain || undefined,
          visibility: importVisibility,
        })),
      }),
    });
    const data = await res.json();
    setUploading(false);
    if (res.ok) {
      // 如果选了文件夹，自动将新条目加入文件夹
      if (selectedFolderId && data.results) {
        const newIds = data.results.filter((r: any) => r.isNew).map((r: any) => r.entry.id);
        for (const entryId of newIds) {
          await fetch(`/api/corpus/collections/${selectedFolderId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entryId }),
          });
        }
      }

      const folderMsg = selectedFolderId ? "，" + (collections.find(c => c.id === selectedFolderId)?.name || "已加入文件夹") : "";
      setImportResult(`导入完成：新增 ${data.created} 条，跳过重复 ${data.skipped} 条${folderMsg} ✅`);
      setShowFileUpload(false);
      setParsedPairs([]);
      setSelectedPairs(new Set());
      setSelectedFolderId("");
      fetchEntries(true);
      fetchCollections();
      setTimeout(() => setImportResult(null), 4000);
    }
  }

  // 文件夹管理
  async function fetchCollections() {
    if (!session) return;
    const res = await fetch("/api/corpus/collections");
    if (res.ok) setCollections(await res.json());
  }

  useEffect(() => { fetchCollections(); }, [session]);

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const tags = newFolderTags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
    const res = await fetch("/api/corpus/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolderName, description: newFolderDesc, tags }),
    });
    if (res.ok) {
      setNewFolderName(""); setNewFolderTags(""); setNewFolderDesc("");
      setShowNewFolder(false); fetchCollections();
      setImportResult("文件夹创建成功 ✅");
      setTimeout(() => setImportResult(null), 3000);
    }
  }

  async function handleDeleteFolder(id: string, name: string) {
    if (!confirm(`确定删除文件夹「${name}」？其中的语料不会被删除。`)) return;
    await fetch(`/api/corpus/collections/${id}`, { method: "DELETE" });
    if (viewingPack?.id === id) setViewingPack(null);
    fetchCollections();
  }

  // 打开语料包查看内容
  async function openPack(col: any) {
    setViewingPack(col);
    setSelectedFolderId(col.id);
    const res = await fetch(`/api/corpus/collections/${col.id}?limit=50`);
    if (res.ok) {
      const data = await res.json();
      setPackEntries(data.entries || []);
      setPackCursor(data.nextCursor || null);
    }
  }

  async function loadMorePackEntries() {
    if (!viewingPack || !packCursor) return;
    const res = await fetch(`/api/corpus/collections/${viewingPack.id}?cursor=${packCursor}&limit=20`);
    if (res.ok) {
      const data = await res.json();
      setPackEntries(prev => [...prev, ...(data.entries || [])]);
      setPackCursor(data.nextCursor || null);
    }
  }

  // 编辑语料
  function openEdit(entry: CorpusEntry) {
    setEditingEntry(entry);
    setEditSource(entry.sourceText);
    setEditTarget(entry.targetText);
    setEditDomain(entry.domain || "");
    setEditVisibility(entry.visibility);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEntry) return;
    const res = await fetch(`/api/corpus/${editingEntry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceText: editSource,
        targetText: editTarget,
        domain: editDomain || undefined,
        visibility: editVisibility,
      }),
    });
    if (res.ok) {
      setEditingEntry(null);
      fetchEntries(true);
      setImportResult("语料已更新 ✅");
      setTimeout(() => setImportResult(null), 3000);
    }
  }

  async function handleDeleteEntry(entryId: string) {
    if (!confirm("确定删除这条语料？此操作不可撤销。")) return;
    const res = await fetch(`/api/corpus/${entryId}`, { method: "DELETE" });
    if (res.ok) {
      fetchEntries(true);
      fetchCollections();
      setImportResult("语料已删除");
      setTimeout(() => setImportResult(null), 3000);
    }
  }

  const visibilityIcon = (v: string) => {
    if (v === "public") return <Globe size={14} className="text-green-500" />;
    if (v === "team") return <Users size={14} className="text-blue-500" />;
    return <Lock size={14} className="text-gray-400" />;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">语料库</h2>
        {session && (
          <div className="flex gap-2">
            <button onClick={() => { setShowFileUpload(!showFileUpload); setShowCreate(false); }}
              className="btn-secondary flex items-center gap-2">
              <Upload size={18} /> 文件导入
            </button>
            <button onClick={() => { setShowCreate(!showCreate); setShowFileUpload(false); }}
              className="btn-primary flex items-center gap-2">
              <Plus size={18} /> 添加语料
            </button>
          </div>
        )}
      </div>

      {/* 操作结果提示 */}
      {importResult && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
          {importResult}
        </div>
      )}

      {/* 我的语料包 */}
      {session && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-700 flex items-center gap-2">
              <FolderOpen size={20} className="text-amber-500" />
              我的语料包
              <span className="text-sm font-normal text-gray-400">({collections.length})</span>
            </h3>
            <button
              onClick={() => { setShowNewFolder(true); setShowCreate(false); }}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <FolderPlus size={16} /> 新建语料包
            </button>
          </div>

          {/* 新建语料包表单 */}
          {showNewFolder && (
            <form onSubmit={handleCreateFolder} className="p-4 mb-3 bg-amber-50/50 rounded-xl border border-amber-200">
              <p className="text-sm text-gray-600 mb-3">
                📦 创建一个空语料包，就像新建一个文件夹。之后导入语料时可以选择归入此包。
              </p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="px-3 py-2.5 rounded-lg border border-gray-300 text-sm
                    focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                  placeholder="语料包名称（如：法律合同、医学文献）" required autoFocus
                />
                <input
                  value={newFolderTags}
                  onChange={(e) => setNewFolderTags(e.target.value)}
                  className="px-3 py-2.5 rounded-lg border border-gray-300 text-sm
                    focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                  placeholder="分类标签，逗号分隔（如：法律, 合同法, 中英）"
                />
              </div>
              <div className="flex gap-3 mt-3">
                <input
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm
                    focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                  placeholder="备注说明（可选）"
                />
                <button type="submit" className="btn-primary text-sm whitespace-nowrap">创建语料包</button>
                <button type="button" onClick={() => setShowNewFolder(false)} className="btn-secondary text-sm">取消</button>
              </div>
            </form>
          )}

          {/* 语料包列表 */}
          {collections.length === 0 && !showNewFolder ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
              <FolderOpen size={40} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 font-medium">还没有语料包</p>
              <p className="text-gray-400 text-sm mt-1 mb-3">
                创建一个语料包来分类管理你的语料，比如"法律合同""科技文献""日常用语"
              </p>
              <button
                onClick={() => setShowNewFolder(true)}
                className="btn-primary text-sm inline-flex items-center gap-1.5"
              >
                <FolderPlus size={16} /> 创建第一个语料包
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {collections.map((col: any) => {
                const tags = JSON.parse(col.tags || "[]");
                return (
                  <div
                    key={col.id}
                    onClick={() => openPack(col)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all group relative
                      ${viewingPack?.id === col.id
                        ? "border-accent-500 bg-accent-50 shadow-sm ring-2 ring-accent-200"
                        : "border-gray-100 bg-gray-50/50 hover:border-amber-300 hover:bg-amber-50/50"
                      }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <FolderOpen size={28} className={viewingPack?.id === col.id ? "text-accent-500" : "text-amber-400"} />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(col.id, col.name); }}
                        className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="删除语料包"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <h4 className="font-semibold text-gray-800 text-sm mb-1">{col.name}</h4>
                    {col.description && (
                      <p className="text-xs text-gray-400 mb-2 line-clamp-2">{col.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {tags.map((tag: string) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 rounded-md bg-white border border-gray-200 text-gray-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>📄 {col._count?.items || 0} 条语料</span>
                      {viewingPack?.id === col.id && (
                        <span className="text-accent-500 font-medium">正在查看 👁</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 创建语料表单 */}
      {showCreate && (
        <div className="card mb-6">
          <h3 className="font-semibold text-gray-700 mb-4">添加双语语料</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  源文本（英文）
                </label>
                <textarea
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300
                             focus:outline-none focus:ring-2 focus:ring-accent-500/20
                             focus:border-accent-500 text-sm h-24"
                  placeholder="输入英文原文..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  译文（中文）
                </label>
                <textarea
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300
                             focus:outline-none focus:ring-2 focus:ring-accent-500/20
                             focus:border-accent-500 text-sm h-24"
                  placeholder="输入中文译文（多个用；分隔）..."
                  required
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  领域
                </label>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300
                             focus:outline-none focus:ring-2 focus:ring-accent-500/20
                             focus:border-accent-500 text-sm"
                  placeholder="如：法律、医学、科技..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  可见性
                </label>
                <select
                  value={newVisibility}
                  onChange={(e) => setNewVisibility(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
                >
                  <option value="private">🔒 仅自己</option>
                  <option value="team">👥 团队</option>
                  <option value="public">🌐 公开</option>
                </select>
              </div>
              <div className="flex items-end">
                <button type="submit" className="btn-primary">
                  保存
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 文件上传导入 */}
      {showFileUpload && (
        <div className="card mb-6">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FileText size={18} /> 从文件导入语料
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            支持 Word(.docx)、Excel(.xlsx/.xls)、PDF、TXT、CSV。自动识别中英双语内容并配对。
          </p>

          {parsedPairs.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              {uploading ? (
                <div className="text-gray-500">
                  <div className="animate-spin w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full mx-auto mb-2" />
                  正在解析文件...
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Upload size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500">点击选择文件或拖拽到此处</p>
                  <p className="text-gray-400 text-xs mt-1">最大 10MB</p>
                  <input type="file" accept=".docx,.xlsx,.xls,.pdf,.txt,.csv"
                    onChange={handleFileUpload} className="hidden" />
                </label>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600">
                  识别到 <strong>{parsedPairs.length}</strong> 对双语语料
                  （已选 {selectedPairs.size} 对）
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedPairs(new Set(parsedPairs.map((_, i) => i)))}
                    className="text-xs text-accent-500 hover:underline">全选</button>
                  <button onClick={() => setSelectedPairs(new Set())}
                    className="text-xs text-gray-400 hover:underline">取消全选</button>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 mb-4 border rounded-lg p-3">
                {parsedPairs.map((pair, i) => (
                  <label key={i} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer
                    ${selectedPairs.has(i) ? "bg-accent-50" : "hover:bg-gray-50"}`}>
                    <input type="checkbox" checked={selectedPairs.has(i)}
                      onChange={() => {
                        const next = new Set(selectedPairs);
                        next.has(i) ? next.delete(i) : next.add(i);
                        setSelectedPairs(next);
                      }}
                      className="mt-1 accent-accent-500" />
                    <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                      <span className="text-gray-800">{pair.source}</span>
                      <span className="text-gray-600">{pair.target}</span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                      pair.confidence === "high" ? "bg-green-50 text-green-600" :
                      pair.confidence === "medium" ? "bg-yellow-50 text-yellow-600" :
                      "bg-gray-50 text-gray-500"}`}>
                      置信度: {pair.confidence === "high" ? "高" : pair.confidence === "medium" ? "中" : "低"}
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <input value={importDomain} onChange={(e) => setImportDomain(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm flex-1
                    focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                  placeholder="领域（如：法律、医学）" />
                <select value={importVisibility} onChange={(e) => setImportVisibility(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm">
                  <option value="private">🔒 仅自己</option>
                  <option value="team">👥 团队</option>
                  <option value="public">🌐 公开</option>
                </select>
                <select value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm">
                  <option value="">📁 选择文件夹（可选）</option>
                  {collections.map((col: any) => (
                    <option key={col.id} value={col.id}>
                      📁 {col.name} ({col._count?.items || 0})
                    </option>
                  ))}
                </select>
                <button onClick={handleConfirmImport} disabled={selectedPairs.size === 0 || uploading}
                  className="btn-primary text-sm whitespace-nowrap">
                  {uploading ? "导入中..." : `导入 ${selectedPairs.size} 条`}
                </button>
                <button onClick={() => { setShowFileUpload(false); setParsedPairs([]); }}
                  className="btn-secondary text-sm">取消</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 语料包内容视图 */}
      {viewingPack && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => { setViewingPack(null); setPackEntries([]); }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              ← 返回全部语料
            </button>
            <span className="text-gray-300">|</span>
            <FolderOpen size={18} className="text-amber-500" />
            <span className="font-semibold text-gray-700">{viewingPack.name}</span>
            <span className="text-sm text-gray-400">({packEntries.length} 条)</span>
          </div>

          {packEntries.length === 0 ? (
            <div className="card text-center py-12">
              <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">此语料包还是空的</p>
              <p className="text-gray-400 text-sm mt-1 mb-4">
                通过上方「添加语料」或「文件导入」添加内容到此包
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {packEntries.map((entry) => (
                <div key={entry.id} className="card hover:shadow-md transition-shadow">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {entry.sourceLang.toUpperCase()}
                        </span>
                        {entry.domain && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-primary-50 text-primary-500">
                            {entry.domain}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-800 text-sm">{entry.sourceText}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2 justify-between">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {entry.targetLang.toUpperCase()}
                        </span>
                        <div className="flex items-center gap-2">
                          {visibilityIcon(entry.visibility)}
                          <button onClick={() => openEdit(entry)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-accent-500">
                            <Edit3 size={14} /> 编辑
                          </button>
                          <button onClick={() => handleDeleteEntry(entry.id)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500">
                            <Trash2 size={14} /> 删除
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm">{entry.targetText}</p>
                    </div>
                  </div>
                </div>
              ))}
              {packCursor && (
                <div className="text-center pt-4">
                  <button onClick={loadMorePackEntries} className="btn-secondary">加载更多</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 搜索与筛选 */}
      {!viewingPack && (<>
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索语料（支持中英文）..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200
                       focus:outline-none focus:ring-2 focus:ring-accent-500/20
                       focus:border-accent-500"
          />
        </div>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm
                     focus:outline-none focus:ring-2 focus:ring-accent-500/20"
        >
          <option value="">全部领域</option>
          <option value="法律">法律</option>
          <option value="医学">医学</option>
          <option value="科技">科技</option>
          <option value="金融">金融</option>
          <option value="文学">文学</option>
          <option value="商务">商务</option>
          <option value="政治">政治</option>
        </select>
      </div>

      {/* 语料列表 */}
      {entries.length === 0 && !loading ? (
        <div className="card text-center py-16">
          <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">暂无语料</p>
          <p className="text-gray-400 text-sm mt-1">
            {session ? "点击上方按钮添加第一条语料" : "登录后即可添加语料"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="card hover:shadow-md transition-shadow">
              <div className="grid grid-cols-2 gap-6">
                {/* 源文本 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                      {entry.sourceLang.toUpperCase()}
                    </span>
                    {entry.domain && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary-50 text-primary-500">
                        {entry.domain}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-800 text-sm leading-relaxed">
                    {entry.sourceText}
                  </p>
                </div>
                {/* 译文 */}
                <div>
                  <div className="flex items-center gap-2 mb-2 justify-between">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                      {entry.targetLang.toUpperCase()}
                    </span>
                    <div className="flex items-center gap-2">
                      {visibilityIcon(entry.visibility)}
                      {session && entry.owner.id === (session.user as any)?.id ? (
                        <>
                          <button onClick={() => openEdit(entry)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-accent-500 transition-colors">
                            <Edit3 size={14} /> 编辑
                          </button>
                          <button onClick={() => handleDeleteEntry(entry.id)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 size={14} /> 删除
                          </button>
                        </>
                      ) : session ? (
                        <>
                          <button onClick={() => handleImportToMine(entry.id)}
                            className="flex items-center gap-1 text-xs text-accent-500 hover:text-accent-600">
                            <Download size={14} /> 导入语料库
                          </button>
                          <button onClick={() => handleSaveToMemory(entry.id)}
                            className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-600">
                            <Brain size={14} /> 存入记忆库
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {entry.targetText}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
                <span>👤 {entry.owner.displayName || entry.owner.username}</span>
                <span>👍 {entry.upvoteCount}</span>
                <span>📖 引用 {entry.usageCount} 次</span>
                <span className="ml-auto">
                  {new Date(entry.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
            </div>
          ))}

          {/* 加载更多 */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={() => fetchEntries(false)}
                disabled={loading}
                className="btn-secondary"
              >
                {loading ? "加载中..." : "加载更多"}
              </button>
            </div>
          )}
        </div>
      )}
      </>)
      }

      {/* 编辑语料弹窗 */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEditingEntry(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">编辑语料</h3>
                <button onClick={() => setEditingEntry(null)} className="p-1 rounded hover:bg-gray-100">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleEditSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">源文本</label>
                    <textarea value={editSource} onChange={(e) => setEditSource(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm
                        focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 h-32"
                      required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">译文</label>
                    <textarea value={editTarget} onChange={(e) => setEditTarget(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm
                        focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 h-32"
                      required />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-600 mb-1">领域</label>
                    <input value={editDomain} onChange={(e) => setEditDomain(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm
                        focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                      placeholder="如：法律、医学" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">可见性</label>
                    <select value={editVisibility} onChange={(e) => setEditVisibility(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-sm">
                      <option value="private">🔒 仅自己</option>
                      <option value="team">👥 团队</option>
                      <option value="public">🌐 公开</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setEditingEntry(null)} className="btn-secondary">取消</button>
                  <button type="submit" className="btn-primary">保存修改</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
