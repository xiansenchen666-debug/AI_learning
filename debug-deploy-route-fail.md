# Debug Session: deploy-route-fail
- **Status**: [OPEN]
- **Issue**: Deno Deploy 预览和生产构建持续报 `Warm up(Failed)` / `Route(Failed)`，日志里仍出现 `Server running on http://localhost:8000/`
- **Debug Server**: Pending
- **Log File**: .dbg/trae-debug-log-deploy-route-fail.ndjson

## Reproduction Steps
1. 推送代码到 GitHub `main`
2. Deno Deploy 自动构建 Preview / Production
3. 构建日志显示 `Warm up(Failed)`、`Route(Failed)`，并打印旧版 `localhost:8000` 日志

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Deno Deploy 实际运行的不是当前仓库里的 `server.ts`，而是旧入口文件或旧 revision | High | Low | Pending |
| B | 部署配置里的入口文件仍指向旧文件，导致当前本地修改根本没有生效 | High | Low | Pending |
| C | GitHub 上的最新提交没有包含当前工作区的修复，线上日志因此仍是旧代码 | High | Low | Pending |
| D | 平台在 warm-up 阶段要求不同的启动方式，当前项目还存在 Deploy 兼容性问题 | Med | Med | Pending |
| E | 构建环境读取的项目根目录不对，路由成功启动但静态文件读取失败 | Med | Med | Pending |

## Log Evidence
- 当前仅有用户提供的部署面板日志，尚未采集到运行时结构化证据。

## Verification Conclusion
- Pending
