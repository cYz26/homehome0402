# Home 402 · 家的空间档案

当前交付为 **metric-v06**：完整展示网站、同源效果图、交互平面图、构件查询、三向剖切与自由漫游。四处平开门按原始户型图修正朝向并全开靠墙；当前参考图与模型同步，旧版示意图保留为历史参考。

## 本地查看

```sh
npm ci
npm run dev
```

构建与预览：

```sh
npm run build
npm run preview -- --port 4173
```

打开 `http://127.0.0.1:4173/`。开发与预览服务仅绑定本机；Vite 用于本机设计预览，线上密码入口由 Worker 提供。远程版本以 Git 提交为准，检查及部署结果以 GitHub Actions 和部署回读为准。

## 持续开发与文档入口

| 层次 | 入口与用途 |
| --- | --- |
| 开发约定 | [AGENTS.md](AGENTS.md)：任务开始时的阅读入口、核心约束及完成要求 |
| 当前实施 | [实施记录](docs/IMPLEMENTATION.md)：已确认范围、决策、完成情况和待验项 |
| 当前设计 | [查看器设计](docs/viewer-design.md)：模块职责、交互和画质；[尺寸依据](docs/dimension-status.md)：建筑事实与估算口径 |
| 验证与交付 | [QA](docs/QA.md)、[发布清单](public/release.json)：验证边界与资源版本 |
| 原始参考 | [架构方案原文](docs/references/house-web-presentation-architecture.md)：保留设计意图，供讨论和追溯 |

原方案已按原文归档，其建议不自动等于当前需求。后续开发从当前实施与设计文档出发；新增决策同步写入对应文档，验证证据绑定实际版本。维护方式及与原方案的差异见[实施记录](docs/IMPLEMENTATION.md#持续开发与文档维护)。

## 操作

- 立体 / 俯视：拖动、缩放，点击模型或平面图查询构件；选择房间定位。
- 定点观景：切换房间或细节机位，拖动上下左右环顾。
- 自由漫游：默认视线 **1.65 m**。电脑 WASD 移动，拖动或方向键环顾，Q 降低、E 升高，Esc 退出。
- 手机漫游：单指滑动立即环顾；静止按住约 0.3 秒开始前进，前进时仍可环顾，松手停止。双指按住约 0.35 秒后上下滑调高度；必须全部松手才能开始下一次前进。
- 选择漫游目的房间后沿可通行路径前往；触摸或按键停止导航。
- 剖切支持水平 Z、东西 X、南北 Y 和完整建筑。碰撞始终使用完整建筑数据。
- 分享链接恢复模式、房间、机位、剖切、画质、视线高度与选中对象；可导出当前 PNG 截图。
- 标准画质使用原生像素比、32 样本 AO、4× MSAA + SMAA、4096 阴影与 1024 主卫镜面；流畅画质由用户手动选择。操作说明中可按需载入高清模型、导出帧时记录。
- 首页主视觉显示后会在后台准备网页模型、查看器代码和导航；进入 3D 时复用资源再启动渲染。提前进入会接管同一批下载，高清模型仍按需加载。

## 建筑数据与文件

`model/apartment.json` 是可编辑设计源，包括墙体、洞口、门窗、固定设施位置与外包尺寸、材质、灯具、空间多边形及机位。

| 文件 | 用途 |
| --- | --- |
| `art_src/apartment-v06.blend` | 当前完整米制源场景 |
| `asset_exchange/apartment-v06.glb` | 原始 GLB，独立重导入核对对象 |
| `public/releases/metric-v06/apartment-web.glb` | KTX2 + Meshopt 网页模型，约 12.74 MiB |
| `public/releases/metric-v06/architecture.json` | 73 个逻辑构件、11 个空间及估算面积 |
| `public/releases/metric-v06/navigation.json` | 完整建筑碰撞、单层可通行网格 |
| `public/releases/metric-v06/floor-plan.svg` | 当前模型派生平面图 |
| `public/release.json` | 发布资源、版本、大小和 SHA-256 清单 |
| `docs/QA.md` | 本轮检查、视觉证据及验收边界 |

墙、窗、平开门由通用算法按 JSON 生成。复杂精装构件的拓扑保留在哈希锁定的 v05 Blender 模板库中，JSON 控制其整体位置、尺寸与材质参数；复杂造型改动仍需更新模板库并重新验证。旧源模型及 GLB 均保留，不进入当前站点构建。

坐标单位为米：图纸 `(x 向东, t 向南, 高度)` → Blender `(x, 12.9-t, 高度)` → GLB `(x, 高度, t-12.9)`。面积为按空间多边形扣除墙体得到的**模型估算**，不作为实测净面积。详细尺寸依据见 `docs/dimension-status.md`。

## 独立重建步骤

```sh
npm run model:build
npm run model:export
npm run model:validate
npm run check:model
npm run model:render
npm run assets:data
npm run assets:optimize
npm run release:prepare
npm run build
npm test
npm run check:release
npx playwright install chromium
npm run test:browser
node scripts/collect-browser-evidence.mjs
```

- 本轮使用 Blender 5.2.1 LTS。可通过 `BLENDER_BIN` 指定 Blender 可执行文件。
- 网页优化使用官方 KTX-Software 4.4.2 的 `ktx`，用 `KTX_BIN` 指定其 `bin` 目录；默认查找 `.asset-work/tools/ktx/bin`。
- 渲染与优化可单独重跑；修改建筑规格后按依赖顺序重新生成派生物。`model:render -- hero` 可仅渲染指定机位。
- `release:prepare` 将实际 Cycles 输出和经脱敏的参考图转换为 WebP，再绑定哈希。网页默认参考为模型渲染，AI 示意与原始照片分别标注。
- 仅修改网页代码时，使用 `npm run release:prepare -- --code-only` 更新源码哈希及应用修订，再执行构建和检查；该入口先验证全部既有资源及非网页设计/生成输入未改变，不需要本机保留渲染缓存。建筑或派生资源变化仍按完整依赖顺序重建。
- 构建前只把清单引用的资源暂存到 `.asset-work/site-public`。高清 GLB 从 `asset_exchange` 读取，按需下载；不重复提交一份大型副本。
- `model:build -- --verify-existing` 在内存中重新建模并核对已验证的构件，不覆盖源文件，用于生成算法等价重构检查。
- `scripts/migrate-semantic.py` 是已执行的一次性迁移工具，不用于日常重建。

## 发布与验收

采用 **私有 GitHub 仓库 → GitHub Actions 验证 → Cloudflare Workers Static Assets 发布**。当前仓库为 [cYz26/homehome0402](https://github.com/cYz26/homehome0402)，网站使用 `/` 根路径；站内旧 `/homehome402/` 分享路径在验证后重定向到根路径，保留视角片段。PR 执行数据一致性、预算与完整 Chromium 浏览器检查；`main` 推送通过检查才发布。CI 使用已生成且哈希匹配的建筑资源，不在发布时重新渲染 Blender。

网站使用共享密码入口。Worker 先验证全部请求，再访问静态资源，图片、图纸、清单、解码器和两个 GLB 都受保护。登录使用 24 小时的 Secure / HttpOnly / SameSite 签名 Cookie，保留分享链接；错误密码限速，缺少密码配置时返回 503。修改密码会使原会话失效，已经下载到访问者设备的内容无法远程收回。页面和资源回复使用 `private, no-store`；模型的既有浏览器哈希缓存仍用于已登录查看。预览版本 URL 默认关闭。

CI 按“构建 → 四个浏览器分片 → 合并验收 → 部署”运行：

- `build` 执行图片元数据脱敏、模型、Node 测试、发布和 Workers 资源限制检查及 Wrangler dry run，只构建一次；保存 `dist`、模型检查结果和完整浏览器测试清单。
- `browser` 在四个独立 runner 上按测试用例分片，每个 runner 保持单 worker、完整画质和零自动重试。所有分片按同一 artifact ID 下载构建，剖切开发夹具也直接读取这份构建资源；只安装 Chromium headless shell。
- `verify` 合并四个 blob 报告，逐项核对测试清单，要求每项恰好执行一次并通过，再收集截图、像素指标及构建哈希。缺片、失败、跳过、重复或缺失附件均不能验收；原始 blob 保留失败 trace。
- `deploy` 等待以上三个作业全部成功，按 artifact ID 下载并发布同一份 `dist`；只安装已锁定的 Wrangler，不再次构建。写入网站访问 secrets 后，对线上所有构建文件执行匿名拒绝 / 登录后 SHA-256 回读，并核对网页及高清 GLB 的 206 分段响应。PR 不接触部署凭据，也不发布。

### 首次部署配置

1. 仓库保持 Private，启用 Actions，停用旧 GitHub Pages 站点，避免旧公开地址继续提供资源。
2. 在目标 Cloudflare 账户配置一个仅用于本项目部署的 API token，采用官方 [Workers CI/CD 权限说明](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)，限定目标账户。凭据只保存在 GitHub Actions secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`；不用 Cloudflare 的 Git 自动构建绕过 Actions 验收。
3. 在本机 `~/.config/home402/site-password.txt` 保存一行网站密码，再运行 `npm run worker:secrets -- --github`，将密码 SHA-256 和随机会话密钥保存为 `SITE_PASSWORD_SHA256` / `SESSION_SECRET`。脚本通过标准输入传递，密码及密钥不进入 Git、静态构建或命令日志。
4. 设置仓库变量 `HOME402_WORKER_URL` 为实际 Worker HTTPS 地址；`wrangler.jsonc` 锁定 Worker 名 `home402`。随后推送 `main`，等待 `build → browser → verify → deploy` 全部成功；`home402-deployment-evidence` artifact 保存实际资源回读。

本机密码入口检查：

```sh
npm run worker:secrets -- --local
npm run build
npm run check:worker
npm run worker:dry-run
npm run worker:dev -- --port 8787
```

打开 `http://127.0.0.1:8787/`。`.dev.vars`、`.wrangler` 及本机密码文件均不提交。完整浏览器套件使用独立测试密码启动本地 Worker，避免读取生产密码；测试端口为 4173 / 4174 / 4175。

Wrangler Static Assets 单资源限制为 25 MiB，当前最大的高清 GLB 为 19,790,028 字节，无需拆分或修改画质；[官方限制](https://developers.cloudflare.com/workers/platform/limits/#static-assets)由 `check:worker` 核对。所有资源都经过密码 Worker，请求计入 Worker 配额；静态存储和边缘缓存仍由 Static Assets 负责，见[计费边界](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)。

本地仍可用 `npm run test:browser` 执行完整套件。排查单个分片可用 `npm run test:browser -- --shard=1/4 --reporter=list,blob`（其余为 `2/4`、`3/4`、`4/4`）；执行下一分片前保存已有 blob ZIP，避免输出目录被清理。完整报告用 `npx playwright merge-reports --reporter=json all-blob-reports` 合并，设置 `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/browser-report.json`，再由证据脚本的 `--inventory` 参数核对构建时通过 `--list --reporter=json` 生成的清单。分片粒度依据 [Playwright 官方说明](https://playwright.dev/docs/test-sharding)。

首屏关键呈现资源预算 1 MiB，呈现后后台预加载及首次可交互 3D 总资源预算 16 MiB（视觉优先），检查包括 JS、模型、属性、导航和解码器。网页纹理保留源图分辨率，使用高质量 KTX2，不再降至 768 像素；UASTC 块对齐为 1256 像素。历史资源保留在仓库中，不随 `public` 全量复制。

桌面浏览器和触摸模拟不能证明真机性能；真实手机持续漫游 ≥30 FPS 仍需设备实测。用户视觉确认状态独立保留，技术检查不会自动代表外观接受。图片脱敏范围见 `docs/privacy-review.md`。
