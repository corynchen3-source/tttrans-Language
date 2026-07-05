"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignInPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("用户名或密码错误");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/30">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-brand-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
              <span className="text-white font-bold text-xl">译</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">欢迎回来</h1>
          <p className="text-slate-400 text-sm mt-1">登录你的译世界账号</p>
        </div>

        {/* 登录表单 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/20 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm text-center font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50/50
                  text-sm text-slate-700 placeholder:text-slate-400
                  focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 focus:bg-white
                  transition-all duration-150"
                placeholder="请输入用户名"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50/50
                  text-sm text-slate-700 placeholder:text-slate-400
                  focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 focus:bg-white
                  transition-all duration-150"
                placeholder="请输入密码"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-sky-600 to-sky-500 text-white text-sm font-semibold
                hover:from-sky-700 hover:to-sky-600 shadow-md shadow-sky-500/20
                transition-all duration-200 disabled:opacity-60"
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </form>

          {/* 微信登录 */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              className="w-full py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium
                hover:bg-slate-50 transition-colors"
              onClick={() => setError("微信登录功能开发中")}
            >
              💬 微信扫码登录
            </button>
          </div>

          <p className="text-center text-sm text-slate-400 mt-5">
            还没有账号？{" "}
            <Link href="/auth/signup" className="text-sky-600 hover:text-sky-700 font-medium hover:underline">
              立即注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
