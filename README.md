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

打开 `http://127.0.0.1:4173/homehome402/`。开发与预览服务仅绑定本机。远程版本以 Git 提交为准，检查及部署结果以 GitHub Actions 为准。

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
- 构建前只把清单引用的资源暂存到 `.asset-work/site-public`。高清 GLB 从 `asset_exchange` 读取，按需下载；不重复提交一份大型副本。
- `model:build -- --verify-existing` 在内存中重新建模并核对已验证的构件，不覆盖源文件，用于生成算法等价重构检查。
- `scripts/migrate-semantic.py` 是已执行的一次性迁移工具，不用于日常重建。

## 发布与验收

现有 GitHub Pages 工作流保留 `/homehome402/` 路径。PR 执行数据一致性、预算、链接与 Chromium 冒烟检查；合并后的 `main` 推送通过检查才发布。CI 使用已生成且哈希匹配的建筑资源，不在发布时重新渲染 Blender。

首屏预算 1 MiB，首次可交互 3D 总资源预算 16 MiB（视觉优先），检查包括 JS、模型、属性、导航和解码器。网页纹理保留源图分辨率，使用高质量 KTX2，不再降至 768 像素；UASTC 块对齐为 1256 像素。历史资源保留在仓库中，不随 `public` 全量复制。

桌面浏览器和触摸模拟不能证明真机性能；真实手机持续漫游 ≥30 FPS 仍需设备实测。用户视觉确认状态独立保留，技术检查不会自动代表外观接受。图片脱敏范围见 `docs/privacy-review.md`。
