# AI 学习机 Deno 云端版

本目录从 `AI_learning_bendi` 迁移而来，使用 Deno、HTML 和 PostgreSQL。

- PostgreSQL：用户、会话、开课关系、学习进度、答题、错题、学习时长和 AI 模型配置
- `data/catalog.json`：课程、课时、题库等发布时生成的静态内容
- 对象存储：图片、音频、PDF、docx 等大文件

## 本地运行

先准备 PostgreSQL 数据库，然后配置环境变量：

```powershell
$env:DATABASE_URL="postgresql://postgres:密码@127.0.0.1:5432/ai_learning"
deno task migrate
deno task start
```

打开：

```text
http://127.0.0.1:8000/login
```

默认账号：

- 学生：`cary` / `123456`
- 学生：`lucy` / `123456`
- 老师：`1` / `1`

`deno task migrate` 会执行 `schema.postgres.sql`，并从
`data/catalog.json` 导入默认用户、开课关系和已有学习记录。迁移可重复执行，
已存在的数据不会被覆盖。

## Deno Deploy

1. 在 Deno 控制台给应用 Attach 一个 Prisma Postgres SQL Database。
2. 在数据库关联设置中，将 Migration Command 设置为：

```text
deno task migrate
```

3. 部署入口使用 `server.ts`。Deno 会自动注入当前环境对应的
   `DATABASE_URL`，不需要填写 MySQL 配置。
4. 在项目的环境变量设置中添加 `AI_CONFIG_ENCRYPTION_KEY` 和
   `DEFAULT_TEACHER_PASSWORD`，并都作为 Secret 保存。前者用于加密教师后台保存的
   API Key，同一环境中应保持稳定，否则已保存的 API Key 将无法解密；后者至少
   12 个字符，迁移时会把仍在使用已知默认值的教师密码安全升级，但不会覆盖已经
   自行修改过的教师密码。
5. 可按需添加下列 AI 默认配置。它们是数据库中尚未保存教师配置时的后备值：

```text
AI_BASE_URL=https://meapi.space
AI_MODEL=gpt-5.4
AI_API_KEY=
AI_ALLOWED_HOSTS=meapi.space
```

`AI_API_KEY` 也应作为 Secret 保存。不要把真实 API Key 写入 `.env.example`、
README 或提交到 Git。Production 和 Preview 环境应分别配置自己的密钥。

正式环境、Git 分支和 Preview 使用相互隔离的 PostgreSQL 数据库，因此每个环境
都会分别执行迁移和种子导入。

## 教师配置 AI 模型

完成部署和数据库迁移后：

1. 使用教师账号登录并进入 `/teacher`。
2. 在 AI 模型配置区域填写服务地址、API Key 和模型名称，然后保存。
3. 服务地址示例为 `https://meapi.space`，模型名称示例为 `gpt-5.4`。
4. 再次打开配置区域时，页面只显示 API Key 的脱敏提示，不会返回完整密钥；
   API Key 留空保存表示保留当前密钥，填写新值才会替换。

模型服务地址必须使用公开可访问的 HTTPS 地址，不能指向本机或私有网络。为避免
把已有密钥误发给另一服务，修改 URL 时必须同时重新填写对应的 API Key。学生端
AI 问答还带有单次内容上限、响应大小上限、超时、分钟级频率限制，以及写入
PostgreSQL 的学生/全站每日请求和 token 额度。默认值可通过
`AI_USER_DAILY_REQUEST_LIMIT`（20）、`AI_GLOBAL_DAILY_REQUEST_LIMIT`（200）、
`AI_USER_DAILY_TOKEN_LIMIT`（500000）和
`AI_GLOBAL_DAILY_TOKEN_LIMIT`（5000000）调整。

`AI_ALLOWED_HOSTS` 使用英文逗号分隔允许的大模型域名，未设置时只允许
`meapi.space`。教师后台只能连接列表内的域名；如以后切换供应商，应先更新这个
环境变量。

教师后台保存的非空配置按字段优先于 `AI_BASE_URL`、`AI_MODEL` 和
`AI_API_KEY` 环境变量。API Key 使用 `AI_CONFIG_ENCRYPTION_KEY` 加密后存入
PostgreSQL，数据库中不保存明文。首次使用后台配置前应显式设置并妥善保存该
加密密钥，不要在部署后随意更换。

## 学习时长写入

学习时长在以下时机写入数据库：

- 连续学习每 5 分钟
- 提交答案后
- 页面切到后台或暂停浏览时
- 切换课时或退出页面时

服务端通过 PostgreSQL `UPSERT ... RETURNING` 在一次查询中完成累计与返回，
不再额外读取一次时长。

## 学习资料

本地开发默认读取 `../AI_learning_bendi/resources`。云端不要把大文件放入
PostgreSQL；上传到对象存储后设置：

```text
RESOURCE_BASE_URL=https://your-bucket.example.com/resources
```

## 更新课程内容

当本地 SQLite 内容库或 resources 更新后运行：

```powershell
deno task export
```

这会重新生成 `data/catalog.json`。
