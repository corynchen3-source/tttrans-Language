# API 接口设计

## 通用规范

- 基础路径：`/api`
- 认证方式：Session Cookie（NextAuth.js）
- 数据格式：JSON
- 分页：cursor-based（`?cursor=xxx&limit=20`）

## 接口列表

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/signup | 用户名密码注册 |
| POST | /api/auth/signin | 用户名密码登录 |
| POST | /api/auth/wechat | 微信扫码登录 |
| POST | /api/auth/signout | 登出 |
| GET | /api/auth/session | 获取当前会话 |

### 语料库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/corpus | 搜索/浏览语料 |
| POST | /api/corpus | 创建语料条目 |
| GET | /api/corpus/[id] | 获取单条语料 |
| PUT | /api/corpus/[id] | 更新语料 |
| DELETE | /api/corpus/[id] | 删除语料 |
| POST | /api/corpus/import | 批量导入 |
| GET | /api/corpus/collections | 我的语料库列表 |
| POST | /api/corpus/collections | 创建语料库 |
| POST | /api/corpus/collections/[id]/add | 添加语料到库 |

### 记忆库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/memory | 浏览记忆库 |
| POST | /api/memory | 添加记忆条目 |
| PUT | /api/memory/[id] | 更新记忆条目 |
| DELETE | /api/memory/[id] | 删除记忆条目 |

### 术语库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/glossary | 浏览术语 |
| POST | /api/glossary | 创建术语 |
| PUT | /api/glossary/[id] | 更新术语 |
| DELETE | /api/glossary/[id] | 删除术语 |
| POST | /api/glossary/import | 批量导入术语 |

### 练习

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/practice | 练习列表 |
| POST | /api/practice | 创建练习 |
| GET | /api/practice/[id] | 练习详情 |
| POST | /api/practice/[id]/submit | 提交译文 |
| POST | /api/practice/[id]/score | 获取机器评分 |
| POST | /api/practice/[id]/review | 提交人工点评 |

### 字幕

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/subtitle | 字幕项目列表 |
| POST | /api/subtitle | 创建字幕项目 |
| GET | /api/subtitle/[id] | 字幕项目详情 |
| POST | /api/subtitle/upload | 上传音视频文件 |
| PUT | /api/subtitle/[id]/segments | 更新字幕段落 |
| GET | /api/subtitle/[id]/export | 导出字幕文件 |

### 团队

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/teams | 我的团队列表 |
| POST | /api/teams | 创建团队 |
| GET | /api/teams/[id] | 团队详情 |
| PUT | /api/teams/[id] | 更新团队 |
| POST | /api/teams/[id]/invite | 邀请成员 |
| DELETE | /api/teams/[id]/members/[uid] | 移除成员 |

### 帖子

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/feed | 帖子信息流 |
| POST | /api/feed | 发布帖子 |
| GET | /api/feed/[id] | 帖子详情 |
| POST | /api/feed/[id]/comments | 评论 |
| POST | /api/feed/[id]/upvote | 点赞 |

### 通知

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/notifications | 通知列表 |
| PUT | /api/notifications/[id]/read | 标记已读 |
