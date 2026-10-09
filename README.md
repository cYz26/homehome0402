# Home 402 · 家的空间档案

当前本机设计为 **metric-v09**：已接入原始 4K PBR 的 Tripo 沙发，加入客餐厅家具、单幅艺术画、暖色洗墙光、透射玻璃与窗外庭院展示。网站同时提供明确区分的 AI 方案效果图、同源模型渲染和实拍；交互平面图、构件查询、三向剖切与漫游沿用。远程已发布状态另见 QA，不能由本机版本推断。

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

打开 `http://127.0.0.1:4173/homehome0402/`。开发与预览服务仅绑定本机，与线上 GitHub Pages 使用相同项目路径。远程版本以 Git 提交为准，检查及部署结果以 GitHub Actions 和部署回读为准。

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

`model/apartment.json` 是可编辑设计源，包括墙体、洞口、门窗、固定设施、家具位置与结构尺寸、材质、灯具、空间多边形及机位。当前客餐厅设计与修订链见[迭代上下文](docs/design/living-v04/DECISION.md)。

| 文件 | 用途 |
| --- | --- |
| `art_src/apartment-v09.blend` | 当前完整米制源场景，包含原始贴图沙发 |
| `art_src/furniture/sofa-tripo-r1-ready.blend` | 哈希锁定的外部家具源；完整版、ZIP / FBX 保留归档 |
| `asset_exchange/apartment-v09.glb` / `living-sofa-v09.glb` | 同版本房屋与沙发两包，合并重导入核对全场景 |
| `public/releases/metric-v09/apartment-web.glb` / `living-sofa-web.glb` | 共同组成当前网页模型；编码与字节记录见 model-packages.json |
| `public/releases/metric-v09/architecture.json` | 89 个逻辑构件、11 个空间及估算面积 |
| `public/releases/metric-v09/navigation.json` | 完整建筑与沙发碰撞、单层可通行网格 |
| `public/releases/metric-v09/floor-plan.svg` | 当前模型派生平面图 |
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
- `release:prepare` 将页面使用的 Cycles 输出和经脱敏的参考图转换为 WebP，再绑定哈希。图廊默认显示最新 AI 方案效果图，仅保留当前效果、户型图和实拍；模型渲染用于首页与空间卡片，历史参考保留归档。
- 仅修改网页代码时，使用 `npm run release:prepare -- --code-only` 更新源码哈希及应用修订，再执行构建和检查；该入口先验证全部既有资源及非网页设计/生成输入未改变，不需要本机保留渲染缓存。建筑或派生资源变化仍按完整依赖顺序重建。
- 构建前只把清单引用的资源暂存到 `.asset-work/site-public`。高清 GLB 从 `asset_exchange` 读取，按需下载；不重复提交一份大型副本。
- `model:build -- --verify-existing` 在内存中重新建模并核对已验证的构件，不覆盖源文件，用于生成算法等价重构检查。
- `scripts/migrate-semantic.py` 是已执行的一次性迁移工具，不用于日常重建。

## 发布与验收

采用 **公开 GitHub 仓库 → GitHub Actions 验证 → GitHub Pages 发布**。当前仓库为 [cYz26/homehome0402](https://github.com/cYz26/homehome0402)，站点为 [Home 402](https://cyz26.github.io/homehome0402/)，使用 `/homehome0402/` 项目路径。网站、图片、图纸、模型和下载均公开、免密码；此前 Workers 入口及其密码验证代码保留历史，不参与当前发布。

PR 执行数据一致性、预算与完整 Chromium 浏览器检查；`main` 推送通过检查才发布。CI 使用已生成且哈希匹配的建筑资源，不在发布时重新渲染 Blender。发布配置为 `.github/workflows/pages.yml` 和 `vite.config.js`；仓库重命名时同步修改站点 base、检查及文档。

CI 按“构建 → 四个浏览器分片 → 合并验收 → 部署”运行：

- `build` 执行图片元数据、模型、Node 测试及发布资源检查，只构建一次；保存 `dist`、模型检查结果和完整浏览器清单，并把同一 `dist` 打包为 Pages artifact。
- `browser` 在四个独立 runner 上按测试用例分片，每个用例使用独立 Chromium 进程、完整画质和零自动重试。所有分片按同一 artifact ID 下载构建，剖切夹具直接读取这份资源；Linux 在 Xvfb 下使用 ANGLE GL，并记录实际 WebGL 后端。Workers 密码入口用例保留历史，当前套件覆盖公开项目路径、资源、Range 及全部应用行为。
- `verify` 合并四个 blob 报告，逐项核对测试清单，要求每项恰好执行一次并通过，再收集截图、像素指标及构建哈希。缺片、失败、跳过、重复或缺失附件均不能验收。
- `deploy` 等待以上作业全部成功，使用官方 configure-pages / deploy-pages 发布已打包产物；按 artifact ID 下载同一份 `dist`，回读全部线上文件 SHA-256、四个模型包的 206 响应及缺失资源 404。PR 不申请 Pages 写权限，也不发布；无需 Cloudflare secrets。

### 首次部署配置

1. 仓库设为 Public，启用 Actions。
2. 在 Settings → Pages → Build and deployment 中选择 GitHub Actions；API 配置对应 `build_type: workflow`。
3. 推送 `main`，等待 `build → browser → verify → deploy` 全部成功。部署作业使用 `github-pages` 环境和短期 GitHub OIDC 凭据，无需手动保存发布 token。
4. 打开 [Home 402](https://cyz26.github.io/homehome0402/)。完整结果见 [QA](docs/QA.md#github-pages-恢复--2026-10-09)，线上资源回读保存在 `home402-deployment-evidence` artifact。

本机预览和浏览器检查使用端口 4173 / 4174，与站点一样保留 `/homehome0402/` 前缀。历史 Worker 凭据和源码不进入 `dist`；其本机测试仍可由原脚本单独执行，不读取或改动生产密码。

既有房屋 / 沙发同步模型包继续保留原分辨率贴图和画质。此前 25 MiB 单文件边界属于 Workers 部署；当前 Pages 发布按项目首屏与完整交互预算检查，不用降低纹理质量完成迁移。

本地仍可用 `npm run test:browser` 执行完整套件。排查单个分片可用 `npm run test:browser -- --shard=1/4 --reporter=list,blob`（其余为 `2/4`、`3/4`、`4/4`）；执行下一分片前保存已有 blob ZIP，避免输出目录被清理。完整报告用 `npx playwright merge-reports --reporter=json all-blob-reports` 合并，设置 `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/browser-report.json`，再由证据脚本的 `--inventory` 参数核对构建时通过 `--list --reporter=json` 生成的清单。分片粒度依据 [Playwright 官方说明](https://playwright.dev/docs/test-sharding)。

metric-v09 的正式图形验收使用独立浏览器进程，避免连续用例复用 GPU 状态：先以 `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/browser-inventory.json npm run test:browser -- --list --reporter=json` 生成完整清单，再运行 `node scripts/run-browser-cases.mjs`。单个正式分片使用 `--shard 1/4`（其余为 2/4、3/4、4/4），所有 blob 合并后仍必须与完整清单逐项匹配、各通过一次。上面的普通命令保留为诊断入口；独立进程与共享进程结果分别记录。采用完整 Chromium 的依据见 [Playwright 新无界面模式说明](https://playwright.dev/docs/browsers#chromium-new-headless-mode)。

首屏关键呈现资源预算 1 MiB，呈现后后台预加载及首次可交互 3D 总资源预算 36 MiB（metric-v09 接入 Tripo 原始 4K PBR，网页模型总预算 34 MiB，实际字节与依据见 `model/resource-budgets.json`），检查包括 JS、模型、属性、导航和解码器。网页纹理保留源图分辨率：房屋使用高质量 KTX2，沙发使用原 4K JPEG / PNG + Meshopt；建筑源 1254 像素图仅按 UASTC 块对齐到 1256 像素。历史资源保留在仓库中，不随 `public` 全量复制。

桌面浏览器和触摸模拟不能证明真机性能；真实手机持续漫游 ≥30 FPS 仍需设备实测。用户视觉确认状态独立保留，技术检查不会自动代表外观接受。图片脱敏范围见 `docs/privacy-review.md`。

当前家具由 `scripts/furniture_geometry.py` 按 `model/apartment.json` 从源生成，最新反馈及选择留在 `docs/design/living-v04/`，v03 / v02 及对应版本记录继续保留。`model/furniture-measurements.json` 保留实际桌面 / 支撑 / 柜墙测量；`scripts/render-furniture-review.py` 可从同一 Blend 生成独立中性形体审查。`src/presentation-environment.js` 从同一规格生成窗外展示几何，由 Three.js 和 Cycles 共用；这部分不属于建筑 GLB、不参与选取 / 碰撞 / 面积，当前只在室内视角显示。

## 当前家具 / 窗外展示源

外部沙发通过 `external_static` 路线读取已视觉检查的 packed Blend，验证 SHA-256，保留原 UV、PBR 和 4K 图像。家具局部 +X 为正面，+Y 为宽度，Z 为高度；由 JSON 位置与朝向变换到房屋坐标。不要只覆盖输出 GLB，或以原程序沙发材质覆盖导入材质。

`modelPackages` 将完整源划为互斥的实体包，导出、重导入、数据与压缩均检查合并语义覆盖。发布清单的 `additionalModels` 必须同主包一起加载，标准 / 高清各有两包，下载区明确列出。既有同步分包保持；网页总预算随完整纹理记录在 `model/resource-budgets.json`，不通过缩图降低画质。KTX 如超过单文件限额，保留原图编码 + Meshopt，实际编码记录在 `model-packages.json`。

窗外庭院使用 `presentationEnvironment` 的确定性展示几何，`src/presentation-environment.js` 同供 Three.js 和 Blender 渲染适配器使用；不加入建筑 GLB、空间面积和碰撞。室内透射玻璃、暖色洗墙和灯光参数来自当前 JSON；AI 氛围图与真实模型始终标明来源。当前设计与历史、尺寸假设、用户要求和验收边界见 [v04 上下文](docs/design/living-v04/DECISION.md)。
