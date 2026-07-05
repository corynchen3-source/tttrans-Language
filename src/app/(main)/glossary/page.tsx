"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Search, Plus, BookMarked, Upload, FileText, FolderOpen, FolderPlus, X, Edit3, Trash2 } from "lucide-react";

interface GlossaryTerm {
  id: string;
  ownerId: string;
  sourceTerm: string;
  targetTerm: string;
  domain: string | null;
  definition: string | null;
  visibility: string;
  isVerified: boolean;
  createdAt: string;
  owner: { id: string; username: string; displayName: string | null };
}

export default function GlossaryPage() {
  const { data: session } = useSession();
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 表单
  const [showCreate, setShowCreate] = useState(false);
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newDef, setNewDef] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [showFileImport, setShowFileImport] = useState(false);
  const [filePreview, setFilePreview] = useState<any[]>([]);
  const [selectedPairs, setSelectedPairs] = useState<Set<number>>(new Set());
  const [importPackId, setImportPackId] = useState("");

  // 编辑
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [editSource, setEditSource] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editDomain, setEditDomain] = useState("");

  // 术语包
  const [collections, setCollections] = useState<any[]>([]);
  const [viewingPack, setViewingPack] = useState<any>(null);
  const [showNewPack, setShowNewPack] = useState(false);
  const [newPackName, setNewPackName] = useState("");
  const [newPackTags, setNewPackTags] = useState("");

  const fetchTerms = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (search) params.set("search", search);
    if (domain) params.set("domain", domain);
    const res = await fetch(`/api/glossary?${params}`);
    const data = await res.json();
    setTerms(data.items || []);
    setLoading(false);
  }, [search, domain]);

  useEffect(() => { fetchTerms(); }, [fetchTerms]);

  const fetchCollections = useCallback(async () => {
    if (!session) return;
    const res = await fetch("/api/glossary/collections");
    if (res.ok) setCollections(await res.json());
  }, [session]);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  // 术语 CRUD
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newSource.trim() || !newTarget.trim()) return;
    const res = await fetch("/api/glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceTerm: newSource, targetTerm: newTarget, domain: newDomain || undefined, definition: newDef || undefined, visibility: "private" }),
    });
    if (res.ok) {
      setNewSource(""); setNewTarget(""); setNewDomain(""); setNewDef("");
      setShowCreate(false); fetchTerms();
      setMessage("术语添加成功 ✅"); setTimeout(() => setMessage(""), 3000);
    }
  }

  async function handleEdit(term: GlossaryTerm) {
    setEditingTerm(term);
    setEditSource(term.sourceTerm);
    setEditTarget(term.targetTerm);
    setEditDomain(term.domain || "");
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTerm) return;
    const res = await fetch(`/api/glossary/${editingTerm.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceTerm: editSource, targetTerm: editTarget, domain: editDomain || undefined }),
    });
    if (res.ok) { setEditingTerm(null); fetchTerms(); }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除此术语？")) return;
    await fetch(`/api/glossary/${id}`, { method: "DELETE" });
    fetchTerms(); fetchCollections();
  }

  async function handleImport() {
    if (!importText.trim()) return;
    const lines = importText.trim().split("\n");
    const importTerms = lines.map((line) => {
      const parts = line.split(/[,\t]/).map((s) => s.trim());
      return { sourceTerm: parts[0] || "", targetTerm: parts[1] || "", domain: parts[2] || undefined };
    }).filter((t) => t.sourceTerm && t.targetTerm);
    const res = await fetch("/api/glossary/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ terms: importTerms }) });
    const data = await res.json();
    if (res.ok) { setImportText(""); setShowImport(false); fetchTerms(); setMessage(data.message); setTimeout(() => setMessage(""), 3000); }
  }

  // 术语包管理
  async function handleCreatePack(e: React.FormEvent) {
    e.preventDefault();
    if (!newPackName.trim()) return;
    const tags = newPackTags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
    await fetch("/api/glossary/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPackName, tags }),
    });
    setNewPackName(""); setNewPackTags(""); setShowNewPack(false); fetchCollections();
    setMessage("术语包创建成功 ✅"); setTimeout(() => setMessage(""), 3000);
  }

  async function handleDeletePack(id: string, name: string) {
    if (!confirm(`确定删除术语包「${name}」？`)) return;
    await fetch(`/api/glossary/collections/${id}`, { method: "DELETE" });
    if (viewingPack?.id === id) setViewingPack(null);
    fetchCollections();
  }

  async function openPack(col: any) {
    setViewingPack(col);
    const res = await fetch(`/api/glossary/collections/${col.id}`);
    if (res.ok) setTerms(await res.json());
  }

  // 文件上传
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/upload/parse", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok && data.pairs?.length > 0) {
      // 显示预览，而不是直接导入
      setFilePreview(data.pairs);
      setSelectedPairs(new Set(data.pairs.map((_: any, i: number) => i)));
      setMessage(`识别到 ${data.pairs.length} 对术语，请选择目标术语包后确认导入`);
      setTimeout(() => setMessage(""), 5000);
    } else { setMessage("❌ " + (data.error || "未识别到术语")); setTimeout(() => setMessage(""), 4000); }
    e.target.value = "";
  }

  // 确认导入并加入术语包
  async function handleConfirmImport() {
    const toImport = filePreview.filter((_, i) => selectedPairs.has(i));
    if (toImport.length === 0) return;

    const r = await fetch("/api/glossary/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terms: toImport.map((p: any) => ({ sourceTerm: p.source, targetTerm: p.target })) }),
    });
    const rd = await r.json();

    if (r.ok && importPackId && rd.created > 0) {
      // 将每个新创建的术语加入选中的包
      // 需要先获取刚导入的术语ID
      const termsRes = await fetch("/api/glossary?limit=50");
      const termsData = await termsRes.json();
      const recentTerms = (termsData.items || []).slice(0, rd.created);
      for (const term of recentTerms) {
        await fetch(`/api/glossary/collections/${importPackId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ termId: term.id }),
        });
      }
      setMessage(`导入完成：新增 ${rd.created} 条，已加入术语包 ✅`);
    } else {
      setMessage(rd.message || "导入完成 ✅");
    }

    setFilePreview([]); setSelectedPairs(new Set()); setImportPackId("");
    fetchTerms(); fetchCollections();
    setTimeout(() => setMessage(""), 4000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">术语库</h2>
        {session && (
          <div className="flex gap-2">
            <label className="btn-secondary flex items-center gap-2 cursor-pointer">
              <FileText size={16} /> 文件导入
              <input type="file" accept=".docx,.xlsx,.xls,.pdf,.txt,.csv" onChange={handleFileUpload} className="hidden" />
            </label>
            <button onClick={() => setShowImport(!showImport)} className="btn-secondary flex items-center gap-2">
              <Upload size={16} /> 文本导入
            </button>
            <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> 添加术语
            </button>
          </div>
        )}
      </div>

      {message && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">{message}</div>}

      {/* 文件导入预览 + 包选择 */}
      {filePreview.length > 0 && (
        <div className="card mb-6 border-2 border-accent-200">
          <h3 className="font-semibold text-gray-700 mb-2">📋 识别到 {filePreview.length} 对术语</h3>
          <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-3 mb-4">
            {filePreview.map((pair: any, i: number) => (
              <label key={i} className={`flex items-center gap-2 p-1.5 rounded text-sm cursor-pointer ${selectedPairs.has(i) ? "bg-accent-50" : "hover:bg-gray-50"}`}>
                <input type="checkbox" checked={selectedPairs.has(i)}
                  onChange={() => { const n = new Set(selectedPairs); n.has(i) ? n.delete(i) : n.add(i); setSelectedPairs(n); }}
                  className="accent-accent-500" />
                <span className="text-gray-800 flex-1">{pair.source}</span>
                <span className="text-gray-400">→</span>
                <span className="text-gray-600 flex-1">{pair.target}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <select value={importPackId} onChange={(e) => setImportPackId(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm">
              <option value="">直接导入（不归入术语包）</option>
              {collections.map((col: any) => (
                <option key={col.id} value={col.id}>
                  📁 {col.name} ({col._count?.items || 0}条)
                </option>
              ))}
            </select>
            <button onClick={handleConfirmImport} disabled={selectedPairs.size === 0}
              className="btn-primary text-sm whitespace-nowrap">
              确认导入 {selectedPairs.size} 对
            </button>
            <button onClick={() => { setFilePreview([]); setSelectedPairs(new Set()); }}
              className="btn-secondary text-sm">取消</button>
          </div>
        </div>
      )}

      {/* 批量导入 */}
      {showImport && (
        <div className="card mb-6">
          <h3 className="font-semibold text-gray-700 mb-2">批量导入术语</h3>
          <p className="text-sm text-gray-500 mb-3">每行一条：源术语,译文,领域</p>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={6}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
            placeholder={"due diligence,尽职调查,法律\nforce majeure,不可抗力,法律"} />
          <div className="flex gap-2 mt-3">
            <button onClick={handleImport} className="btn-primary text-sm">确认导入</button>
            <button onClick={() => setShowImport(false)} className="btn-secondary text-sm">取消</button>
          </div>
        </div>
      )}

      {/* 添加术语 */}
      {showCreate && (
        <div className="card mb-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input value={newSource} onChange={(e) => setNewSource(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" placeholder="源术语（如：due diligence）" required />
              <input value={newTarget} onChange={(e) => setNewTarget(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" placeholder="译文（如：尽职调查）" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" placeholder="领域" />
              <input value={newDef} onChange={(e) => setNewDef(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" placeholder="定义说明（可选）" />
            </div>
            <button type="submit" className="btn-primary text-sm">保存术语</button>
          </form>
        </div>
      )}

      {/* 术语包管理 */}
      {session && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-700 flex items-center gap-2">
              <FolderOpen size={20} className="text-amber-500" /> 我的术语包
              <span className="text-sm font-normal text-gray-400">({collections.length})</span>
            </h3>
            <button onClick={() => setShowNewPack(true)} className="btn-primary flex items-center gap-1.5 text-sm">
              <FolderPlus size={16} /> 新建术语包
            </button>
          </div>

          {showNewPack && (
            <form onSubmit={handleCreatePack} className="flex items-center gap-3 mb-3 p-3 bg-amber-50/50 rounded-lg border border-amber-200">
              <input value={newPackName} onChange={(e) => setNewPackName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                placeholder="术语包名称" required autoFocus />
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
                  onClick={() => viewingPack?.id === col.id ? (setViewingPack(null), fetchTerms()) : openPack(col)}
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
            <p className="text-sm text-gray-400">创建术语包来分类管理你的术语</p>
          )}
        </div>
      )}

      {/* 搜索 */}
      {!viewingPack && (
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索术语..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" />
          </div>
          <select value={domain} onChange={(e) => setDomain(e.target.value)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm">
            <option value="">全部领域</option>
            <option value="法律">法律</option><option value="医学">医学</option>
            <option value="科技">科技</option><option value="金融">金融</option><option value="商务">商务</option>
          </select>
        </div>
      )}

      {/* 术语表格 */}
      {terms.length === 0 && !loading ? (
        <div className="card text-center py-16">
          <BookMarked size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">{viewingPack ? `术语包「${viewingPack.name}」为空` : "暂无术语"}</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">源术语</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">译文</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">领域</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((term) => (
                <tr key={term.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-3">
                    <span className="text-sm font-medium text-gray-800">{term.sourceTerm}</span>
                    {term.definition && <p className="text-xs text-gray-400 mt-0.5">{term.definition}</p>}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{term.targetTerm}</td>
                  <td className="px-6 py-3">
                    {term.domain && <span className="text-xs px-2 py-0.5 rounded bg-primary-50 text-primary-500">{term.domain}</span>}
                  </td>
                  <td className="px-6 py-3">
                    {session && (session.user as any)?.id === term.owner.id && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(term)} className="p-1 rounded text-gray-400 hover:text-accent-500"><Edit3 size={14} /></button>
                        <button onClick={() => handleDelete(term.id)} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingTerm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEditingTerm(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">编辑术语</h3>
                <button onClick={() => setEditingTerm(null)} className="p-1"><X size={20} className="text-gray-400" /></button>
              </div>
              <form onSubmit={handleEditSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">源术语</label>
                  <input value={editSource} onChange={(e) => setEditSource(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">译文</label>
                  <input value={editTarget} onChange={(e) => setEditTarget(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">领域</label>
                  <input value={editDomain} onChange={(e) => setEditDomain(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" />
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setEditingTerm(null)} className="btn-secondary">取消</button>
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
