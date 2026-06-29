# 星途启航 AI 学习机 Deno 云端版

这个目录是从 `AI_learning_bendi` 迁移出的 Deno + HTML + MySQL 版本：

- 前端页面来自 `AI_learning_bendi/frontend`
- 课程、课时、题目来自 `AI_learning_bendi/data/learning_machine.db` 导出的 `data/catalog.json`
- 运行时数据使用 MySQL：登录会话、学生账号、开课关系、答题记录、错题、学习时长
- 学习资料文件不放 MySQL；本地开发读取 `../AI_learning_bendi/resources`，云端建议放对象存储

## 本地安装 Deno

Windows PowerShell：

```powershell
irm https://deno.land/install.ps1 | iex
deno --version
```

如果 `deno --version` 提示找不到命令，重新打开 PowerShell，或把下面目录加入 PATH：

```text
%USERPROFILE%\.deno\bin
```

## MySQL 准备

先创建数据库：

```sql
CREATE DATABASE ai_learning DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

服务启动时会自动建表并从 `data/catalog.json` 导入默认用户、开课关系和已有学习记录。也可以手动执行：

```powershell
mysql -u root -p ai_learning < schema.mysql.sql
```

本地环境变量示例：

```powershell
$env:MYSQL_HOST="127.0.0.1"
$env:MYSQL_PORT="3306"
$env:MYSQL_USER="root"
$env:MYSQL_PASSWORD="你的密码"
$env:MYSQL_DATABASE="ai_learning"
deno task start
```

也可以只配一个连接串：

```powershell
$env:DATABASE_URL="mysql://root:你的密码@127.0.0.1:3306/ai_learning"
deno task start
```

## 本地运行

```powershell
deno task export
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

## 学习资料存储建议

当前 `AI_learning_bendi/resources` 约 886MB，里面大多是图片、docx、markdown。不要把这些文件塞到 MySQL 里。

推荐结构：

- MySQL：用户、权限、课程购买、进度、错题等业务数据
- `data/catalog.json`：课程目录、课时正文、题库等发布时生成的静态索引
- 对象存储：docx、图片、音频、PDF 页面图等大文件

云端部署时，把资料上传到对象存储后设置：

```text
RESOURCE_BASE_URL=https://your-bucket.example.com/resources
```

这样 `/api/resources/...` 会跳转到对象存储地址。

## 重新导出内容

如果 `AI_learning_bendi` 的 SQLite 或 resources 更新了，运行：

```powershell
deno task export
```

它会重新生成 `data/catalog.json`。

## 部署到 Deno

此项目和旧 `AI_learning_网页端` 一样使用 `deno.json` 的 `deploy` 配置，入口是 `server.ts`。部署时包含：

- `server.ts`
- `schema.mysql.sql`
- `*.html`
- `assets/**/*`
- `data/catalog.json`

需要在 Deno Deploy 的环境变量里配置 `DATABASE_URL` 或 `MYSQL_HOST` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE`。
