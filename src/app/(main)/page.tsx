"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  BookOpen, Brain, BookMarked, PenLine, Subtitles,
  MessageCircle, Heart, Plus, Send
} from "lucide-react";

const quickLinks = [
  { icon: BookOpen, label: "语料库", href: "/corpus", desc: "浏览共享语料，搭建私人语料库" },
  { icon: Brain, label: "记忆库", href: "/memory", desc: "收藏满意的翻译译文" },
  { icon: BookMarked, label: "术语库", href: "/glossary", desc: "管理专业术语双语对照" },
  { icon: PenLine, label: "口笔译练习", href: "/practice", desc: "上传素材练习并获得评分" },
  { icon: Subtitles, label: "实时字幕", href: "/subtitle", desc: "音视频双语字幕翻译" },
];

const typeLabels: Record<string, string> = {
  translation_recommendation: "原文译文推荐",
  corpus_share: "语料库分享",
  glossary_share: "术语库分享",
  discussion: "翻译讨论",
};

export default function HomePage() {
  const { data: session } = useSession();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("latest");
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newType, setNewType] = useState("discussion");

  // 评论
  const [commentingPost, setCommentingPost] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/feed?sort=${tab}&limit=20`);
    if (res.ok) {
      const data = await res.json();
      setPosts(data.items || []);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;
    const res = await fetch("/api/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, body: newBody, postType: newType }),
    });
    if (res.ok) {
      setNewTitle(""); setNewBody(""); setNewType("discussion"); setShowNewPost(false);
      fetchPosts();
    }
  }

  async function handleUpvote(postId: string) {
    if (!session) return;
    await fetch(`/api/feed/${postId}/upvote`, { method: "POST" });
    fetchPosts();
  }

  async function handleComment(postId: string) {
    if (!session || !commentText.trim()) return;
    await fetch(`/api/feed/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentText }),
    });
    setCommentText("");
    // 刷新该帖评论
    const res = await fetch(`/api/feed/${postId}/comments`);
    if (res.ok) {
      const comments = await res.json();
      setPostComments(prev => ({ ...prev, [postId]: comments }));
    }
  }

  async function toggleComments(postId: string) {
    if (commentingPost === postId) {
      setCommentingPost(null);
    } else {
      setCommentingPost(postId);
      const res = await fetch(`/api/feed/${postId}/comments`);
      if (res.ok) {
        const comments = await res.json();
        setPostComments(prev => ({ ...prev, [postId]: comments }));
      }
    }
  }

  return (
    <div>
      {/* 欢迎横幅 */}
      <div className="relative overflow-hidden rounded-2xl mb-8 bg-gradient-to-br from-brand-600 via-brand-500 to-ocean-600 p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full translate-y-1/3" />
        <div className="relative">
          <h2 className="text-2xl font-bold mb-2 tracking-tight">欢迎来到译世界</h2>
          <p className="text-white/75 max-w-xl text-sm leading-relaxed">
            集语料库、记忆库、术语库、口笔译练习、实时字幕翻译为一体的综合性翻译社区。
            在这里，积累翻译资产，提升翻译技能，与同行交流分享。
          </p>
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {quickLinks.map((item, idx) => {
          const Icon = item.icon;
          const gradients = [
            "from-sky-50 to-sky-100 text-sky-600",
            "from-emerald-50 to-emerald-100 text-emerald-600",
            "from-purple-50 to-purple-100 text-purple-600",
            "from-amber-50 to-amber-100 text-amber-600",
            "from-rose-50 to-rose-100 text-rose-600",
          ];
          return (
            <Link key={item.href} href={item.href}
              className="group bg-white rounded-xl border border-slate-100 p-4
                hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
                flex flex-col items-center gap-2 text-center">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradients[idx]} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                <Icon size={22} />
              </div>
              <span className="font-semibold text-slate-700 text-sm">{item.label}</span>
              <span className="text-[11px] text-slate-400 leading-tight">{item.desc}</span>
            </Link>
          );
        })}
      </div>

      {/* 帖子信息流 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">社区动态</h3>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {[
              { key: "latest", label: "最新" },
              { key: "hot", label: "热门" },
            ].map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  tab === t.key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          {session && (
            <button onClick={() => setShowNewPost(!showNewPost)}
              className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={16} /> 发帖
            </button>
          )}
        </div>
      </div>

      {/* 发帖表单 */}
      {showNewPost && (
        <form onSubmit={handleCreatePost} className="card mb-4">
          <div className="flex gap-3 mb-3">
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              placeholder="帖子标题" required />
            <select value={newType} onChange={(e) => setNewType(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm">
              <option value="discussion">翻译讨论</option>
              <option value="translation_recommendation">原文译文推荐</option>
              <option value="corpus_share">语料库分享</option>
              <option value="glossary_share">术语库分享</option>
            </select>
          </div>
          <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 min-h-24"
            placeholder="分享你的翻译心得、推荐译文、或讨论翻译问题..." required />
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" onClick={() => setShowNewPost(false)} className="btn-secondary text-sm">取消</button>
            <button type="submit" className="btn-primary text-sm">发布</button>
          </div>
        </form>
      )}

      {/* 帖子列表 */}
      {posts.length === 0 && !loading ? (
        <div className="card text-center py-16">
          <MessageCircle size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">还没有帖子</p>
          <p className="text-gray-400 text-sm mt-1">成为第一个发帖的人吧</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <article key={post.id} className="card hover:shadow-md transition-shadow">
              <div className="mb-3">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-500 mb-2">
                  {typeLabels[post.postType] || post.postType}
                </span>
                <h4 className="text-lg font-semibold text-gray-800 mb-1">{post.title}</h4>
              </div>
              <p className="text-gray-600 text-sm mb-4 whitespace-pre-wrap line-clamp-4">{post.body}</p>
              <div className="flex items-center justify-between text-sm text-gray-400">
                <div className="flex items-center gap-4">
                  <span>👤 {post.author.displayName || post.author.username}</span>
                  <span>🕐 {new Date(post.createdAt).toLocaleDateString("zh-CN")}</span>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => handleUpvote(post.id)}
                    className={`flex items-center gap-1 transition-colors ${session ? "hover:text-red-500" : ""}`}>
                    <Heart size={16} /> {post._count?.upvotes || 0}
                  </button>
                  <button onClick={() => toggleComments(post.id)}
                    className="flex items-center gap-1 hover:text-accent-500 transition-colors">
                    <MessageCircle size={16} /> {post._count?.comments || 0}
                  </button>
                </div>
              </div>

              {/* 评论区 */}
              {commentingPost === post.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                    {(postComments[post.id] || []).length === 0 && (
                      <p className="text-sm text-gray-400">暂无评论</p>
                    )}
                    {(postComments[post.id] || []).map((c: any) => (
                      <div key={c.id} className="p-2 bg-gray-50 rounded-lg text-sm">
                        <span className="font-medium text-gray-600">{c.author.displayName || c.author.username}</span>
                        <span className="text-gray-500 ml-2">{c.body}</span>
                      </div>
                    ))}
                  </div>
                  {session && (
                    <div className="flex gap-2">
                      <input value={commentText} onChange={(e) => setCommentText(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                        placeholder="写评论..."
                        onKeyDown={(e) => e.key === "Enter" && handleComment(post.id)} />
                      <button onClick={() => handleComment(post.id)} disabled={!commentText.trim()}
                        className="btn-primary text-xs flex items-center gap-1">
                        <Send size={12} /> 发送
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
