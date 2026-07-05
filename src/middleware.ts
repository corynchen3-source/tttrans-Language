import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// 可公开浏览的页面（读权限，写需要登录）
const publicRoutes = [
  "/", "/auth/signin", "/auth/signup",
  "/corpus", "/glossary", "/memory",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // 公开路由 + API 直接放行
  if (
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/corpus/") ||
    pathname.startsWith("/glossary/")
  ) {
    return NextResponse.next();
  }

  // 未登录重定向到登录页
  if (!isLoggedIn) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
