import type { Metadata } from "next";
import { SessionProvider } from "@/lib/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "译世界 — 翻译学习与交流社区",
  description:
    "集语料库、记忆库、术语库、口笔译练习、实时字幕翻译为一体的综合性翻译社区",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
