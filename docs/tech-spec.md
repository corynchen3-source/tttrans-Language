# 技术方案

## 技术栈

| 层面 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Next.js (App Router) | 14+ |
| UI 库 | React | 18+ |
| 语言 | TypeScript | 5+ |
| 样式 | Tailwind CSS | 3+ |
| 组件库 | shadcn/ui | latest |
| 数据库 ORM | Prisma | 5+ |
| 数据库 | PostgreSQL | 16 |
| 缓存 | Redis | 7 |
| 认证 | NextAuth.js | 5 (Auth.js) |
| 实时通信 | Socket.io | 4 |
| 语音识别 | OpenAI Whisper | large-v3 |
| 翻译 API | DeepL + Google + 有道 + 百度 | - |

## 架构

```
用户浏览器
    │
    ▼
┌─────────────────────────────────┐
│        Next.js 应用              │
│  ┌───────────┐ ┌──────────────┐ │
│  │ App Router │ │  API Routes │ │
│  │ (SSR/SSG) │ │  (REST)     │ │
│  └───────────┘ └──────┬───────┘ │
│                       │          │
│  ┌────────────────────┼───────┐  │
│  │      服务层         │       │  │
│  │  CorpusService     │       │  │
│  │  MemoryService     │       │  │
│  │  GlossaryService   │       │  │
│  │  ScoringService    │       │  │
│  │  SubtitleService   │       │  │
│  │  TeamService       │       │  │
│  │  FeedService       │       │  │
│  └────────────────────┼───────┘  │
└───────────────────────┼─────────┘
                        │
    ┌───────────────────┼───────────────┐
    │                   │               │
┌───▼──────┐  ┌────────▼─────┐  ┌──────▼──────┐
│PostgreSQL│  │    Redis     │  │  R2 Storage │
└──────────┘  └──────────────┘  └─────────────┘
```

## 数据库核心表

- users — 用户
- teams / team_members — 团队
- corpus_entries / corpus_collections — 语料库
- memory_entries — 记忆库
- glossary_terms — 术语库
- practice_sessions / practice_submissions / practice_scores — 练习
- subtitle_projects / subtitle_segments — 字幕
- posts / post_comments / post_upvotes — 帖子
- notifications — 通知

## 部署

- 应用：Vercel
- 数据库：Supabase (PostgreSQL)
- 缓存：Upstash (Redis)
- 存储：Cloudflare R2 (S3 兼容)
- 语音识别：自托管 Whisper (GPU 服务器)
