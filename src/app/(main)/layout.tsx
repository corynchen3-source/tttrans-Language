"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  BookOpen, Brain, BookMarked, PenLine, Subtitles,
  Home, Search, Bell, Users, LogOut,
} from "lucide-react";

const navItems = [
  { icon: Home, label: "首页", href: "/" },
  { icon: BookOpen, label: "语料库", href: "/corpus" },
  { icon: Brain, label: "记忆库", href: "/memory" },
  { icon: BookMarked, label: "术语库", href: "/glossary" },
  { icon: PenLine, label: "口笔译练习", href: "/practice" },
  { icon: Subtitles, label: "实时字幕翻译", href: "/subtitle" },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!session) return;
    fetch("/api/notifications").then(r => r.json()).then(d => {
      setNotifications(d.notifications || []);
      setUnreadCount(d.unreadCount || 0);
    });
  }, [session]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/30">
      {/* 左侧导航栏 */}
      <aside className="w-56 bg-white border-r border-slate-100 flex flex-col shrink-0">
        {/* Logo */}
        <Link href="/" className="px-4 py-4 block">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-brand-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
              <span className="text-white font-bold text-lg">译</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">译世界</h1>
              <p className="text-[11px] text-slate-400 leading-tight">翻译学习与交流社区</p>
            </div>
          </div>
        </Link>
        <div className="px-4 pb-1">
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150 cursor-pointer
                  ${active
                    ? "bg-sky-50 text-sky-700 shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  }`}
              >
                <Icon size={18} className={active ? "text-sky-600" : "text-slate-400"} />
                <span>{item.label}</span>
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-500" />
                )}
              </Link>
            );
          })}

          <div className="my-2 mx-3 h-px bg-slate-100" />

          <Link
            href="/teams"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-150 cursor-pointer
              ${isActive("/teams")
                ? "bg-sky-50 text-sky-700 shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
          >
            <Users size={18} className={isActive("/teams") ? "text-sky-600" : "text-slate-400"} />
            <span>团队</span>
          </Link>
        </nav>

        {/* 底部用户区 */}
        <div className="px-3 py-3 border-t border-slate-100">
          {session?.user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-brand-500 flex items-center justify-center text-white text-sm font-medium shadow-sm">
                  {(session.user as any)?.username?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {(session.user as any)?.username || session.user.name}
                  </p>
                  <p className="text-[11px] text-slate-400">在线</p>
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/50 py-1 animate-in">
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <LogOut size={15} />
                    退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/auth/signin"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg
                bg-gradient-to-r from-sky-600 to-sky-500 text-white text-sm font-medium
                hover:from-sky-700 hover:to-sky-600 shadow-md shadow-sky-500/20
                transition-all duration-200">
              登录 / 注册
            </Link>
          )}
        </div>
      </aside>

      {/* 右侧主区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部栏 */}
        <header className="h-14 bg-white/80 backdrop-blur-sm border-b border-slate-100 flex items-center justify-between px-6 shrink-0">
          <div className="relative w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索语料、术语、帖子..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200
                text-sm text-slate-600 placeholder:text-slate-400
                focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 focus:bg-white
                transition-all duration-150"
            />
          </div>
          <div className="flex items-center gap-2">
            {/* 通知 */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold shadow-sm">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 z-50 max-h-80 overflow-y-auto">
                  <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-700">通知</span>
                    {unreadCount > 0 && (
                      <button onClick={async () => {
                        await fetch("/api/notifications", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
                        setUnreadCount(0);
                      }} className="text-xs text-sky-600 hover:underline font-medium">全部已读</button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="p-4 text-sm text-slate-400 text-center">暂无通知</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`p-3 border-b border-slate-50 text-sm ${n.isRead ? "bg-white" : "bg-sky-50/50"}`}>
                        <p className="text-slate-700 font-medium text-xs">{n.title}</p>
                        {n.body && <p className="text-slate-500 text-[11px] mt-0.5">{n.body}</p>}
                        <p className="text-slate-400 text-[10px] mt-1">{new Date(n.createdAt).toLocaleDateString("zh-CN")}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
