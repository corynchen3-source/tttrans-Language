# 翻译社区网站 — 项目指引

## 项目概述

中英翻译综合社区网站，集语料库、记忆库、术语库、口笔译练习、实时字幕翻译于一体。

## 重要文件路径

| 用途 | 路径 |
|------|------|
| 需求文档 | [docs/requirements.md](docs/requirements.md) |
| 技术方案 | [docs/tech-spec.md](docs/tech-spec.md) |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) |
| 执行步骤 | [docs/execution-steps.md](docs/execution-steps.md) |
| API 设计 | [docs/api-design.md](docs/api-design.md) |
| 部署指南 | [docs/deploy-guide.md](docs/deploy-guide.md) |
| 开发日志 | [dev-logs/](dev-logs/) |
| 数据库 Schema | [prisma/schema.prisma](prisma/schema.prisma) |

## 工作原则

1. **稳步推进**：一个阶段完成并验证后再进入下一阶段，不冒进
2. **每日记录**：每天开发结束后更新 dev-logs/ 下的日志文件
3. **规范先行**：涉及架构决策时先更新 docs/ 下对应文档
4. **中文优先**：所有界面文案、注释、文档均使用中文

## 技术栈

- **前端**: Next.js 14 (App Router) + React 18 + TypeScript
- **样式**: Tailwind CSS + shadcn/ui
- **数据库**: PostgreSQL + Prisma ORM
- **缓存**: Redis
- **认证**: NextAuth.js (用户名密码 + 微信)
- **实时通信**: Socket.io
- **语音识别**: OpenAI Whisper
- **翻译接口**: DeepL / Google / 有道 / 百度

## 目录结构

```
翻译网站/
├── CLAUDE.md              # 本文件
├── docs/                  # 规范文档
├── dev-logs/              # 每日开发日志
├── prisma/                # 数据库 Schema
├── public/                # 静态资源
├── src/
│   ├── app/               # Next.js App Router 页面
│   │   ├── layout.tsx     # 根布局（侧边栏+主面板）
│   │   ├── page.tsx       # 首页（帖子信息流）
│   │   ├── (main)/         # 主功能区页面
│   │   │   ├── corpus/    # 语料库
│   │   │   ├── memory/    # 记忆库
│   │   │   ├── glossary/  # 术语库
│   │   │   ├── practice/  # 口笔译练习
│   │   │   ├── subtitle/  # 实时字幕翻译
│   │   │   └── teams/     # 团队管理
│   │   └── api/           # API 路由
│   ├── components/        # 可复用组件
│   ├── lib/               # 工具库和服务
│   └── styles/            # 全局样式
└── package.json
```

## 命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run db:push  # 推送数据库 Schema 变更
npm run db:studio # 打开 Prisma Studio 查看数据库
```
