# AI 学习机 Deno 云端版

本目录从 `AI_learning_bendi` 迁移而来，使用 Deno、HTML 和 PostgreSQL。

- PostgreSQL：用户、会话、开课关系、学习进度、答题、错题和学习时长
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
http://127.0.0.1:8000/login.html
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

正式环境、Git 分支和 Preview 使用相互隔离的 PostgreSQL 数据库，因此每个环境
都会分别执行迁移和种子导入。

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
