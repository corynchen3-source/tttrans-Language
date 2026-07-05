"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Plus, Upload, Mic, Square, Play, Download, BookOpen, Edit3, Trash2, Save, ListVideo, Brain, BookMarked
} from "lucide-react";

export default function SubtitlePage() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProject, setActiveProject] = useState<any>(null);
  const [mode, setMode] = useState<"list" | "edit" | "live">("list");
  const [message, setMessage] = useState("");

  const [uploading, setUploading] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  // 媒体播放
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [isAudioFile, setIsAudioFile] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const uploadedFileRef = useRef<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");

  // 自动识别
  const [autoRecognizing, setAutoRecognizing] = useState(false);

  // 实时录音翻译
  const [isRecording, setIsRecording] = useState(false);
  const [liveSegments, setLiveSegments] = useState<any[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const liveProjectRef = useRef<any>(null);

  // 手动添加字幕
  const [addingSub, setAddingSub] = useState(false);
  const [subStart, setSubStart] = useState(0);
  const [subEnd, setSubEnd] = useState(0);
  const [subSource, setSubSource] = useState("");
  const [subTarget, setSubTarget] = useState("");

  // 编辑弹窗
  const [editingSeg, setEditingSeg] = useState<any>(null);
  const [editSource, setEditSource] = useState("");
  const [editTarget, setEditTarget] = useState("");

  useEffect(() => { if (session) fetchProjects(); }, [session]);

  async function fetchProjects() {
    const res = await fetch("/api/subtitle");
    if (res.ok) setProjects(await res.json());
  }

  async function handleCreateProject() {
    const res = await fetch("/api/subtitle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle || "未命名项目", sourceType: "file_upload" }),
    });
    if (res.ok) {
      const project = await res.json();
      setActiveProject(project);
      setNewTitle(""); setMode("edit"); setMediaLoaded(false);
      fetchProjects();
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeProject) return;

    const isAudio = file.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(file.name);
    const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv|avi)$/i.test(file.name);
    if (!isAudio && !isVideo) { setMessage("❌ 不支持的文件格式，支持 MP3/MP4/MOV/AVI/WAV 等"); return; }

    const url = URL.createObjectURL(file);
    uploadedFileRef.current = file;
    setMediaUrl(url);
    setIsAudioFile(isAudio);
    setMediaLoaded(true);
    setMessage(`✅ ${file.name} 已加载，点击「有道AI 自动识别」生成字幕`);
  }

  // 自动识别：优先有道ASR → 失败则浏览器识别 → 有道翻译
  async function handleAutoRecognize() {
    const file = uploadedFileRef.current;
    const el = audioRef.current || videoRef.current;
    if (!file || !el?.src) { setMessage("❌ 请先上传音视频文件"); return; }

    setAutoRecognizing(true);

    // ═══ 方式一：有道长语音转写（直接处理上传文件）═══
    try {
      setMessage("🤖 有道长语音转写中...（直接处理上传的音频文件）");
      const fd = new FormData(); fd.append("file", file);
      const apiRes = await fetch("/api/subtitle/youdao", { method: "POST", body: fd });
      const apiData = await apiRes.json();

      if (apiRes.ok && apiData.segments?.length > 0) {
        await saveSegments(apiData.segments);
        setAutoRecognizing(false);
        setMessage(`✅ 有道AI完成！${apiData.segments.length} 段双语字幕已生成`);
        return;
      }
      // 有道ASR不可用，提示并降级
      setMessage("⚠️ 有道语音识别暂不可用，降级为浏览器识别...");
    } catch { setMessage("⚠️ 有道连接失败，降级为浏览器识别..."); }

    // ═══ 方式二：浏览器语音识别 + 有道翻译 ═══
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setAutoRecognizing(false); setMessage("❌ 请使用 Chrome 浏览器"); return; }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US"; recognition.continuous = true; recognition.interimResults = true;
      const collected: string[] = [];

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const t = event.results[i][0].transcript.trim();
            if (t) collected.push(t);
          }
        }
        setMessage(`🎤 已识别 ${collected.length} 句，正在有道翻译...`);
      };
      recognition.onerror = () => {};
      recognition.start();
      el.currentTime = 0; el.play();

      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (el.ended || el.paused || !autoRecognizing) { clearInterval(check); recognition.stop(); resolve(); }
        }, 500);
      });
      el.pause();

      if (collected.length === 0) { setAutoRecognizing(false); setMessage("❌ 未识别到语音"); return; }

      setMessage(`✅ 识别完成(${collected.length}句)，有道翻译中...`);
      const apiRes = await fetch("/api/subtitle/youdao", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texts: collected }),
      });
      const apiData = await apiRes.json();

      if (apiRes.ok && apiData.segments?.length > 0) {
        await saveSegments(apiData.segments);
        setMessage(`✅ 完成！${apiData.segments.length} 段中英双语字幕已生成`);
      } else { setMessage(`❌ 翻译失败: ${apiData.error || ""}`); }
    } catch (e: any) { setMessage("❌ 错误: " + e.message); }
    setAutoRecognizing(false);
  }

  // 手动添加字幕
  function startAddSubtitle() {
    const el = audioRef.current || videoRef.current;
    if (el) el.pause();
    const t = el?.currentTime || 0;
    setSubStart(Math.round(t * 10) / 10);
    setSubEnd(Math.round((t + 4) * 10) / 10);
    setSubSource(""); setSubTarget("");
    setAddingSub(true);
  }

  async function handleAddSubtitle(e: React.FormEvent) {
    e.preventDefault();
    if (!subSource.trim() || !activeProject) return;
    const newSeg = { startTime: subStart, endTime: subEnd, sourceText: subSource, targetText: subTarget };
    const updated = [...(activeProject.segments || []), newSeg].sort((a: any, b: any) => a.startTime - b.startTime);
    await fetch(`/api/subtitle/${activeProject.id}/segments`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ segments: updated }),
    });
    const res = await fetch(`/api/subtitle/${activeProject.id}`);
    if (res.ok) setActiveProject(await res.json());
    setAddingSub(false);
  }

  async function saveSegments(segments: any[]) {
    if (!activeProject) return;
    const updated = [...(activeProject.segments || []), ...segments.map((s: any, i: number) => ({
      ...s, sequence: (activeProject.segments?.length || 0) + i + 1,
    }))].sort((a: any, b: any) => a.startTime - b.startTime);
    await fetch(`/api/subtitle/${activeProject.id}/segments`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ segments: updated }),
    });
    const projRes = await fetch(`/api/subtitle/${activeProject.id}`);
    if (projRes.ok) setActiveProject(await projRes.json());
  }

  // ============================================================
  // 实时录音翻译
  // ============================================================
  async function startLiveRecording() {
    // 先创建项目
    const res = await fetch("/api/subtitle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "实时翻译 " + new Date().toLocaleTimeString("zh-CN"), sourceType: "live_capture" }),
    });
    if (!res.ok) { setMessage("创建项目失败"); return; }
    const project = await res.json();
    liveProjectRef.current = project;
    setActiveProject(project);
    setLiveSegments([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      mediaRecorder.onstop = async () => {
        // 录制停止，发送整段音频到有道识别
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
        const fd = new FormData();
        fd.append("file", blob, "recording." + (mediaRecorder.mimeType.includes("webm") ? "webm" : "mp4"));
        setMessage("🎤 录音完成，正在有道AI识别...");
        try {
          const apiRes = await fetch("/api/subtitle/youdao", { method: "POST", body: fd });
          const apiData = await apiRes.json();
          if (apiRes.ok && apiData.segments?.length > 0) {
            setLiveSegments(apiData.segments);
            await saveSegmentsToProject(liveProjectRef.current.id, apiData.segments);
            setMessage(`✅ 实时翻译完成！${apiData.segments.length} 段双语字幕已生成`);
          } else { setMessage(`❌ ${apiData.error || "识别失败"}`); }
        } catch { setMessage("❌ 网络错误"); }
        stream.getTracks().forEach(t => t.stop());
      };

      // 每8秒切割一次音频块
      mediaRecorder.start(8000);
      setIsRecording(true);
      setMessage("🔴 正在录音... 每8秒生成一段字幕");
    } catch {
      setMessage("❌ 无法访问麦克风，请检查浏览器权限");
    }
  }

  function stopLiveRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function saveSegmentsToProject(projectId: string, segments: any[]) {
    if (!projectId) return;
    const projRes = await fetch(`/api/subtitle/${projectId}`);
    const proj = await projRes.json();
    const updated = [...(proj.segments || []), ...segments.map((s: any, i: number) => ({
      ...s, sequence: (proj.segments?.length || 0) + i + 1,
    }))].sort((a: any, b: any) => a.startTime - b.startTime);

    await fetch(`/api/subtitle/${projectId}/segments`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ segments: updated }),
    });
    const refreshed = await fetch(`/api/subtitle/${projectId}`);
    if (refreshed.ok) setActiveProject(await refreshed.json());
  }

  // 编辑/删除
  async function handleSaveSegment() {
    if (!editingSeg || !activeProject) return;
    await fetch(`/api/subtitle/${activeProject.id}/segments`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segmentId: editingSeg.id, sourceText: editSource, targetText: editTarget }),
    });
    setEditingSeg(null);
    const res = await fetch(`/api/subtitle/${activeProject.id}`);
    if (res.ok) setActiveProject(await res.json());
  }

  async function handleDeleteSegment(segId: string) {
    if (!activeProject) return;
    const updated = activeProject.segments.filter((s: any) => s.id !== segId);
    await fetch(`/api/subtitle/${activeProject.id}/segments`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ segments: updated }),
    });
    const res = await fetch(`/api/subtitle/${activeProject.id}`);
    if (res.ok) setActiveProject(await res.json());
  }

  // 存入语料库/记忆库/术语库
  async function handleSaveTo(type: "corpus" | "memory" | "glossary", seg: any) {
    const source = seg.sourceText;
    const target = seg.targetText || seg.sourceText;

    if (type === "corpus") {
      await fetch("/api/corpus", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: source, targetText: target, visibility: "private" }),
      });
      setMessage("✅ 已添加到语料库");
    } else if (type === "memory") {
      await fetch("/api/memory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: source, targetText: target, sourceType: "subtitle" }),
      });
      setMessage("✅ 已添加到记忆库");
    } else {
      await fetch("/api/glossary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceTerm: source, targetTerm: target, visibility: "private" }),
      });
      setMessage("✅ 已添加到术语库");
    }
    setTimeout(() => setMessage(""), 2000);
  }

  function handleExport(format: string) {
    if (!activeProject) return;
    window.open(`/api/subtitle/${activeProject.id}/export?format=${format}&bilingual=true`);
  }

  async function handleDeleteProject(id: string) {
    if (!confirm("确定删除？")) return;
    await fetch(`/api/subtitle/${id}`, { method: "DELETE" });
    if (activeProject?.id === id) { setActiveProject(null); setMode("list"); }
    fetchProjects();
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  async function handleOpenProject(project: any) {
    const res = await fetch(`/api/subtitle/${project.id}`);
    if (res.ok) { setActiveProject(await res.json()); setMode("edit"); }
  }

  if (!session) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-6">实时字幕翻译</h2>
        <div className="card text-center py-16">
          <Upload size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">请先登录后使用字幕翻译功能</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">实时字幕翻译</h2>
        {mode === "list" ? (
          <div className="flex gap-2">
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="input w-44" placeholder="项目名称" />
            <button onClick={handleCreateProject} className="btn-primary text-sm"><Plus size={16} /> 创建项目</button>
            <button onClick={() => setMode("live")} className="btn-secondary text-sm"><Mic size={16} /> 实时翻译</button>
          </div>
        ) : mode === "live" ? (
          <button onClick={() => { setMode("list"); setActiveProject(null); }} className="btn-secondary text-sm">← 返回列表</button>
        ) : (
          <button onClick={() => { setMode("list"); setActiveProject(null); }} className="btn-secondary text-sm">← 返回列表</button>
        )}
      </div>

      {message && <div className="mb-4 p-3 rounded-lg bg-sky-50 text-sky-700 text-sm font-medium">{message}</div>}

      {/* 项目列表 */}
      {mode === "list" && (
        projects.length === 0 ? (
          <div className="card text-center py-16">
            <ListVideo size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">还没有字幕项目，输入名称创建</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} onClick={() => handleOpenProject(p)} className="card cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">{p.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span>📝 {p._count?.segments || 0} 段</span>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 实时翻译模式 */}
      {mode === "live" && (
        <div className="card text-center">
          <h3 className="font-semibold text-slate-700 mb-2">🎙️ 实时翻译</h3>
          <p className="text-sm text-slate-500 mb-6">点击开始录音，系统将自动转写+翻译，生成中英双语字幕</p>

          {!isRecording ? (
            <div>
              <button onClick={startLiveRecording} className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center mx-auto shadow-lg transition-all">
                <Mic size={40} />
              </button>
              <p className="text-slate-400 text-sm mt-3">点击开始录音</p>
            </div>
          ) : (
            <div>
              <button onClick={stopLiveRecording} className="w-24 h-24 rounded-full bg-slate-700 hover:bg-slate-800 text-white flex items-center justify-center mx-auto shadow-lg animate-pulse transition-all">
                <Square size={36} />
              </button>
              <p className="text-red-500 text-sm mt-3 font-medium">🔴 录音中... 点击停止</p>
            </div>
          )}

          {/* 实时字幕预览 */}
          {liveSegments.length > 0 && (
            <div className="mt-6 text-left">
              <h4 className="text-sm font-medium text-slate-600 mb-2">已生成字幕 ({liveSegments.length})</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {liveSegments.map((seg, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-lg">
                    {seg.targetText && <p className="text-slate-800 text-sm font-medium">{seg.targetText}</p>}
                    <p className="text-slate-500 text-sm">{seg.sourceText}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 编辑模式 */}
      {mode === "edit" && activeProject && (
        <div className="space-y-6">
          {/* 文件上传 + 自动识别 */}
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-3">{activeProject.title}</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <input type="file" accept="video/*,audio/*,.mp3,.mp4,.mov,.avi,.wav,.m4a,.webm,.mkv" onChange={handleFileUpload} className="hidden" id="fileInput" />
              <label htmlFor="fileInput" className={`text-sm cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                mediaLoaded ? "btn-secondary" : "bg-sky-500 text-white hover:bg-sky-600 shadow-md"
              }`}>
                <Upload size={14} /> {mediaLoaded ? "重新上传" : "上传音视频"}
              </label>

              {mediaLoaded && (
                <button onClick={handleAutoRecognize} disabled={autoRecognizing}
                  className="bg-gradient-to-r from-red-500 to-rose-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:from-red-600 hover:to-rose-600 shadow-lg animate-pulse">
                  🎤 {autoRecognizing ? "AI识别中..." : "有道AI 自动识别 →"}
                </button>
              )}

              {mediaLoaded && (
                <button onClick={startAddSubtitle} className="btn-secondary text-sm">
                  <Plus size={14} /> 手动添加
                </button>
              )}
            </div>
            {!mediaLoaded && (
              <div className="mt-4 p-4 bg-sky-50 rounded-xl border border-sky-100 text-center">
                <p className="text-sky-700 text-sm font-medium">📁 点击上方按钮上传音视频文件</p>
                <p className="text-sky-500 text-xs mt-1">支持 MP3 / MP4 / MOV / AVI / WAV / WebM 格式</p>
              </div>
            )}
            {mediaLoaded && (
              <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-100 text-center">
                <p className="text-green-700 text-sm font-medium">{isAudioFile ? "🎵 音频" : "🎬 视频"}已就绪</p>
                <p className="text-green-600 text-xs mt-1">点击红色「有道AI 自动识别」按钮开始生成双语字幕</p>
              </div>
            )}
          </div>

          {/* 媒体播放器 — 始终渲染，CSS 控制显隐 */}
          <div className={mediaLoaded ? "card p-0 overflow-hidden" : "hidden"}>
            <div className={`relative rounded-xl overflow-hidden ${isAudioFile ? "bg-gradient-to-br from-slate-800 to-slate-900" : "bg-black"}`}>
              {isAudioFile ? (
                <div className="p-6 text-center">
                  <span className="text-4xl">🎵</span>
                  <p className="text-white/80 text-sm mt-2 mb-4">音频播放器 — 点击下方播放按钮</p>
                  <audio key={mediaUrl} ref={audioRef} src={mediaUrl} className="w-full" controls preload="auto"
                    onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
                    onLoadedData={() => setMessage(`✅ 音频已就绪，点击播放按钮`)} />
                </div>
              ) : (
                <video key={mediaUrl} ref={videoRef} src={mediaUrl} className="w-full max-h-80 object-contain" controls preload="auto"
                  onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
                  onLoadedData={() => setMessage(`✅ 视频已就绪，点击播放按钮`)} />
              )}
                {/* 字幕叠加 —— 中文在上，英文在下 */}
                {activeProject.segments?.filter((seg: any) => currentTime >= seg.startTime && currentTime <= seg.endTime).map((seg: any) => (
                  <div key={seg.id} className="absolute bottom-20 left-0 right-0 text-center pointer-events-none px-4">
                    {seg.targetText && (
                      <p className="text-white text-lg font-bold bg-black/70 inline-block px-4 py-2 rounded-lg mb-1">{seg.targetText}</p>
                    )}
                    <p className="text-slate-300 text-sm bg-black/60 inline-block px-3 py-1 rounded">{seg.sourceText}</p>
                  </div>
                ))}
                <div className="absolute bottom-3 right-4 text-white text-xs bg-black/60 px-2 py-0.5 rounded font-mono">{formatTime(currentTime)}</div>
              </div>
            </div>
          )}

          {/* 手动添加字幕表单 */}
          {addingSub && (
            <form onSubmit={handleAddSubtitle} className="card border-2 border-sky-200">
              <p className="text-sm font-medium text-slate-700 mb-3">添加字幕段落</p>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs text-slate-500">开始: {subStart}s</span>
                <span className="text-xs text-slate-500">结束: {subEnd}s</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input value={subSource} onChange={(e) => setSubSource(e.target.value)} className="input" placeholder="原文（英文）" required />
                <input value={subTarget} onChange={(e) => setSubTarget(e.target.value)} className="input" placeholder="译文（中文）" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-sm"><Save size={14} /> 保存</button>
                <button type="button" onClick={() => setAddingSub(false)} className="btn-secondary text-sm">取消</button>
              </div>
            </form>
          )}

          {/* 字幕列表 + 导出 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700">📋 字幕段落 ({(activeProject.segments || []).length})</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => handleExport("srt")} className="btn-secondary text-xs"><Download size={12} /> SRT</button>
                <button onClick={() => handleExport("vtt")} className="btn-secondary text-xs"><Download size={12} /> VTT</button>
              </div>
            </div>

            {(activeProject.segments || []).length === 0 ? (
              <div className="text-center py-10 text-slate-400">上传文件后点击「有道AI自动识别」生成字幕</div>
            ) : (
              <div className="space-y-2">
                {activeProject.segments.map((seg: any) => {
                  const isCurrent = mediaLoaded && currentTime >= seg.startTime && currentTime <= seg.endTime;
                  return (
                    <div key={seg.id} className={`p-4 rounded-xl border transition-all ${isCurrent ? "border-sky-400 bg-sky-50" : "border-slate-100 hover:bg-slate-50"}`}>
                      {/* 时间 + 操作 */}
                      <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => { const el = videoRef.current || audioRef.current; if (el) { el.currentTime = seg.startTime; el.play(); } }}
                          className={`text-xs font-mono px-2 py-0.5 rounded ${isCurrent ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-500"} cursor-pointer`}>
                          {formatTime(seg.startTime)} - {formatTime(seg.endTime)}
                        </button>
                        <div className="flex gap-0.5 ml-auto">
                          <button onClick={() => { setEditingSeg(seg); setEditSource(seg.sourceText); setEditTarget(seg.targetText || ""); }}
                            className="p-1.5 rounded text-slate-400 hover:text-sky-500" title="编辑"><Edit3 size={14} /></button>
                          <button onClick={() => handleSaveTo("corpus", seg)}
                            className="p-1.5 rounded text-slate-400 hover:text-emerald-500" title="存语料库"><BookOpen size={14} /></button>
                          <button onClick={() => handleSaveTo("memory", seg)}
                            className="p-1.5 rounded text-slate-400 hover:text-purple-500" title="存记忆库"><Brain size={14} /></button>
                          <button onClick={() => handleSaveTo("glossary", seg)}
                            className="p-1.5 rounded text-slate-400 hover:text-amber-500" title="存术语库"><BookMarked size={14} /></button>
                          <button onClick={() => handleDeleteSegment(seg.id)}
                            className="p-1.5 rounded text-slate-400 hover:text-red-500" title="删除"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {/* 中文在上，英文在下 */}
                      {seg.targetText && <p className="text-slate-800 text-sm font-medium mb-0.5">{seg.targetText}</p>}
                      <p className="text-slate-500 text-sm">{seg.sourceText}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingSeg && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEditingSeg(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">编辑字幕</h3>
            <div className="space-y-4">
              <div><label className="text-sm text-slate-500 mb-1 block">原文（英文）</label>
                <textarea value={editSource} onChange={(e) => setEditSource(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm h-24 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" /></div>
              <div><label className="text-sm text-slate-500 mb-1 block">译文（中文）</label>
                <textarea value={editTarget} onChange={(e) => setEditTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm h-24 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" /></div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setEditingSeg(null)} className="btn-secondary">取消</button>
                <button onClick={handleSaveSegment} className="btn-primary"><Save size={14} /> 保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
