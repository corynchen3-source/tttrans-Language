# 部署上线指南

## 第一步：安装必要工具

终端运行：
```bash
xcode-select --install   # 安装 Git（约2分钟）
```

## 第二步：代码推送到 GitHub

```bash
cd /Users/chenxinyue/Desktop/翻译网站

# 初始化 Git
git init
git add .
git commit -m "译世界翻译社区网站 v1.0"

# 在 GitHub 创建仓库后（https://github.com/new）
git remote add origin https://github.com/你的用户名/translation-hub.git
git push -u origin main
```

## 第三步：数据库切换

1. 打开 [db.new](https://db.new) 或 [supabase.com](https://supabase.com) 创建免费 PostgreSQL
2. 修改 `prisma/schema.prisma` 中的：
```
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
3. 把 Supabase 给的连接字符串填入环境变量 `DATABASE_URL`

## 第四步：Vercel 部署

1. 打开 [vercel.com](https://vercel.com) 用 GitHub 登录
2. 点击 New Project → 导入 GitHub 仓库
3. 配置环境变量：
   | 变量 | 值 |
   |------|-----|
   | AUTH_SECRET | openssl rand -base64 32 生成 |
   | NEXTAUTH_URL | https://你的域名.vercel.app |
   | DATABASE_URL | Supabase 连接字符串 |
   | XFYUN_APP_ID | 8c4ae252 |
   | XFYUN_API_KEY | 你的讯飞ApiKey |
   | XFYUN_API_SECRET | 你的讯飞ApiSecret |
4. 点击 Deploy

## 注意事项

- 讯飞 WebSocket API 需要 Vercel Pro（$20/月）支持 60 秒超时；免费版 10 秒可能不够
- 替代方案：用 Supabase 部署后端 API，或使用 Railway / Fly.io 等支持长连接的平台
- 数据库约 $0/月起（Supabase 免费版含 500MB）
