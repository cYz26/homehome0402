# Home 402 Workers 首次发布验收 · 2026-10-08


2026-10-08 已发布至 [Home 402](https://home402.cyz26.workers.dev)。[私有仓库](https://github.com/cYz26/homehome0402)经 GitHub CLI 再次核实为 Private；部署源提交为 `6deeb6063f2e8da181d1eb6cc887c967b5bd280c`，[Actions 37746437839](https://github.com/cYz26/homehome0402/actions/runs/37746437839)最终第 2 次 attempt 全部成功。只重跑首次回读失败的 deploy，复用已验收的构建 artifact `11536062375`；未重建或替换建筑资源。

| 检查 | 最终实际结果 |
| --- | --- |
| 远程构建 | Node 51 / 51、模型 19 / 19、发布 13 / 13、图片脱敏、Worker 资源与打包预检通过 |
| 远程浏览器 | Linux x64 / 2 CPU / 8 GiB / Chromium 153.0.8010.12；17 / 17，零失败、跳过、重试或 flaky，合并执行跨度 471.1 秒；完整清单恰好执行一次 |
| 标准 / 高清 | 全流程 387.1 秒；单次人工下载延迟 25 秒；实际 HD 就绪 115.9 秒，后续细节 / 俯视 / 立体等待约 0.1 / 9.0 / 7.2 秒；纹理、镜面、AO、阴影及切面断言均保留 |
| 构建与证据 | 收集 39 张截图、2 份像素 / 阶段指标和版本绑定收据；线上 39 个文件逐项 SHA-256 与同一构建一致 |
| 访问与传输 | 匿名首页为 401 密码页，39 个匿名资源 HEAD 均为 401；两个 GLB 的 64 KiB Range 均为 206 且字节一致，匿名 Range 为 401，缺失资源为 404 |
| 实际密码与页面 | 在真实 HTTPS 地址用本机密码完成桌面 1280 × 900、手机宽度 390 × 844 登录；分享视角、模型、受保护清单和 Range 可用；Cookie 为 Secure / HttpOnly / SameSite Strict；退出后恢复密码页并拒绝资源 |
| 画面与异常 | 已查看线上手机密码页及登录后的户型画面；标题、非空画布、无横向溢出、无框架错误覆盖层、页面与应用控制台无错误均通过 |

首次上传 Worker 与 secrets 均成功，但紧接着的回读命中配置传播期，入口保持 503 关闭状态。随后实际入口已为 401；仅重跑失败部署作业后，自动完整回读通过（08:14:44 UTC），本机再次完整回读通过（08:15:01 UTC）。Cloudflare 控制面核实当前版本 `5504cadc-b49d-4b70-b4d6-8caf96680a15` 为 100% 流量；部署 ID 为 `ae9c8f03-7bc6-4bc1-b555-65dec32b2acc`。

原始远程报告及回读保存在本机 `/tmp/home402-workers-remote/final-browser-evidence/`、`final-deployment-evidence/`；线上页面截图和交互收据保存在 `/Users/cY/.codex/visualizations/2026/10/08/01a119d4-85a7-7f50-aa33-4f949f2caedd/home402-workers/`。Browser 工具初始化不可用，实际页面验证采用项目 Playwright；上述手机宽度是桌面 Chromium 模拟，真实 iOS Safari / Android Chrome 手势与持续漫游性能仍待真机实测。客厅讨论及参考图在途改动保留，未应用到本次建筑和发布资产。

