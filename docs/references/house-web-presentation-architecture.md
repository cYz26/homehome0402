# Codex + GPT-6 房屋设计最终展现与 Web 交付方案

## 1. 目标

本方案面向基于 **Codex + GPT-6 + Blender** 的 AI 房屋设计流程，重点解决设计完成后的最终展现、交互浏览、设计说明和工程数据交付问题。

最终交付不应只是若干 Blender 效果图，也不应只是一个可旋转的 3D 模型，而应形成一个完整的 **Architecture Viewer / Digital House Presentation**：

- 通过高质量离线渲染建立第一视觉印象；
- 通过 Web 实时 3D 帮助用户理解空间结构；
- 通过平面图、剖切、Dollhouse、漫游等不同视角表达设计；
- 通过房间、墙体、门窗、家具等语义对象实现可查询、可交互；
- 支持不同设计方案对比；
- 支持 BIM / IFC 等专业建筑数据扩展；
- 由 Codex 自动完成模型导出、优化、渲染、网站构建和视觉 QA。

核心原则：

> **Blender 负责高质量视觉表现，Three.js 负责 Web 实时交互，Semantic Design Model / IFC 负责建筑语义和数据，网站负责最终的交互式设计交付。**

---

# 2. 总体架构

```text
                    Natural Language
                           │
                           ▼
                    GPT-6 / Codex
                           │
                           ▼
                 Semantic Design Model
                    house.design.json
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
          Blender       IFC/BIM      Floor Plan
             │          Export           │
             │             │             │
     ┌───────┴───────┐     │             │
     ▼               ▼     ▼             ▼
Cycles Render       GLB   house.ifc   floorplan.json
     │               │
     │               ▼
     │          Web Optimization
     │               │
     └───────┬───────┘
             ▼
      Architecture Website
             │
     ┌───────┼───────────────┐
     ▼       ▼               ▼
  Hero    Interactive 3D   Drawings
 Render      Viewer       / BIM Data
```

建议将 Blender 看作：

> **设计模型的视觉编译与资产生成后端**

而不是整个设计系统唯一的数据源。

---

# 3. 最终交付形态

最终网站同时承担：

1. **建筑设计展示网站**
2. **交互式 3D Viewer**
3. **数字化设计说明书**
4. **建筑模型浏览器**
5. **设计方案比较工具**
6. **BIM / IFC 数据入口**

页面可以组织为：

```text
01  HERO
    高质量 Cycles 主视觉

02  OVERVIEW
    建筑信息 / 面积 / 户型 / 设计理念

03  INTERACTIVE HOUSE
    Dollhouse / Floor Plan / Walkthrough / Section

04  SPACES
    客厅 / 厨房 / 卧室 / 卫生间 / 阳台等空间

05  DESIGN DETAILS
    材质 / 门窗 / 家具 / 尺寸 / 细节

06  OPTION COMPARE
    不同设计方案对比

07  DRAWINGS
    平面图 / 剖面图 / 立面图

08  TECHNICAL DATA
    BIM / IFC / Measurement / Semantic Metadata
```

---

# 4. Offline Render + Realtime Render 混合方案

不建议要求浏览器完全取代 Blender Cycles。

最终视觉体系建议分成两部分。

## 4.1 Blender Cycles

负责：

- Hero Render；
- 高质量室内效果图；
- 建筑外观图；
- 重点空间特写；
- 高质量 Dollhouse；
- 视频和镜头动画；
- 全局光照；
- 复杂玻璃、反射；
- 高质量阴影；
- 景深；
- 高质量材质细节。

适用于：

```text
第一视觉印象
设计提案
宣传展示
高质量静态输出
```

---

## 4.2 Web Realtime Renderer

建议使用：

```text
Three.js
+
WebGL2
+
可选 WebGPU Enhancement
```

负责：

- 模型旋转；
- 房间浏览；
- Floor Plan；
- Dollhouse；
- Cutaway；
- 第一人称漫游；
- 对象点击；
- 房间高亮；
- 测量；
- 信息查询；
- 材质切换；
- 日夜切换；
- 方案比较。

二者关系：

```text
Blender
   │
   ├── Cycles ─────→ Premium Visual
   │
   └── GLB ────────→ Interactive Web
```

---

# 5. Hero 首屏

网站加载后不应首先显示：

```text
Loading model...
```

而应立即展示一张 Blender Cycles 输出的高质量主视觉。

推荐 Hero 类型：

- 建筑外观；
- 45° Dollhouse；
- 客厅主视角；
- 最具设计特征的核心空间。

结构示例：

```text
┌──────────────────────────────────────────┐
│                                          │
│            High Quality Render           │
│                                          │
│              XX Residence                │
│                                          │
│     Modern Residential Renovation        │
│                                          │
│             Explore in 3D →              │
│                                          │
└──────────────────────────────────────────┘
```

这样可以：

- 第一屏立即可见；
- 避免等待 3D 模型加载；
- 保证设计展示质量；
- 后台渐进加载 Web 3D 资源。

---

# 6. Interactive 3D Viewer

Web Viewer 是整个方案的核心。

建议使用：

```text
React / Next.js
        +
Three.js
```

如需要 React 组件化场景，也可以使用：

```text
React Three Fiber
```

Viewer 推荐提供以下模式。

---

# 7. Dollhouse Mode

Dollhouse 建议作为默认 3D 浏览模式。

典型设置：

```text
Camera:
    Orthographic

Elevation:
    30° ~ 45°

Azimuth:
    30° ~ 60°

Roof:
    hidden

Exterior wall:
    partial hidden / clipped
```

效果类似：

```text
       ╱──────────────╱
      ╱   Bedroom    ╱│
     ├──────────────┤ │
     │              │ │
     │    Living    │╱
     │              │
     └──────────────┘
```

优势：

- 同时表达空间布局和高度；
- 家具位置清晰；
- 房间关系清晰；
- 比普通透视鸟瞰更容易理解；
- 特别适合住宅设计。

---

# 8. Floor Plan Mode

Floor Plan 可以通过：

```text
Top Orthographic Camera
+
Section Height
+
Semantic Overlay
```

生成。

除了模型本身，建议叠加：

```text
Living Room
24.6 m²

Bedroom
13.2 m²

Bathroom
5.8 m²
```

以及：

- 房间名称；
- 面积；
- 墙体；
- 门窗；
- 家具；
- 尺寸线；
- 朝向；
- 比例尺。

例如：

```text
              4200
        ──────────────

┌───────────────────────┐
│       Bedroom         │
│       13.2 m²         │
├────────────┬──────────┤
│            │ Bathroom │
│   Living   │  5.8 m²  │
│   24.6 m²  │          │
│            │          │
└────────────┴──────────┘
```

---

# 9. Cutaway / Section Mode

建议不要人工删除墙体来制造剖切效果，而应使用统一的：

```text
Section Plane
```

例如：

```text
完整建筑
    ↓
Section Plane
    ↓
实时裁切
```

支持：

- 横剖；
- 纵剖；
- 单层剖切；
- 局部剖切；
- 自定义剖切面；
- Dollhouse Cutaway。

UI 可以提供：

```text
Section X
Section Y
Floor Cut
Reset
```

高级模式可以允许用户拖动 Section Plane。

---

# 10. Walkthrough Mode

第一人称漫游建议使用：

```text
Eye Height ≈ 1.55 ~ 1.70 m
FOV ≈ 60° ~ 70°
```

支持：

```text
Keyboard:
WASD

Mouse:
Look Around

Mobile:
Virtual Joystick
```

必须增加：

- 地面碰撞；
- 墙体碰撞；
- 固定眼高；
- 楼梯约束；
- 防止穿墙；
- 防止进入柜体；
- 防止自由飞行。

同时提供空间导航入口：

```text
Living Room →
Kitchen →
Master Bedroom →
Bathroom →
Balcony →
```

用户点击后平滑移动到对应空间。

---

# 11. Camera Presets

自由控制相机不应是用户理解设计的唯一方式。

建议自动定义一组摄影机视角：

```json
{
  "views": [
    {
      "id": "overview",
      "name": "整体空间"
    },
    {
      "id": "living",
      "name": "客厅"
    },
    {
      "id": "kitchen",
      "name": "厨房"
    },
    {
      "id": "master-bedroom",
      "name": "主卧"
    },
    {
      "id": "bathroom",
      "name": "卫生间"
    }
  ]
}
```

Web UI：

```text
[整体] [客厅] [厨房] [主卧] [卫生间]
```

切换时使用：

```text
Camera A
   ↓
Interpolation
   ↓
Camera B
```

避免瞬间跳转。

---

# 12. Floor Plan + 3D 联动

这是非常值得实现的交互。

布局示例：

```text
┌──────────────────────────┬──────────────┐
│                          │              │
│                          │   Bedroom    │
│                          │              │
│          3D              ├──────┬───────┤
│                          │      │ Bath  │
│                          │Living│       │
│                          │      │       │
└──────────────────────────┴──────┴───────┘
```

当鼠标 Hover：

```text
Floor Plan:
Bathroom

        ↓

3D:
Bathroom Highlight
```

反向操作：

```text
Click Room in 3D
        ↓
Highlight Floor Plan Polygon
```

这个能力依赖统一的 Semantic ID。

例如：

```text
ROOM_BATHROOM_01
```

同时存在于：

```text
house.design.json
Blender Object
GLB Node
floorplan.json
Web UI
```

---

# 13. Semantic Interaction

模型中的对象不只是 Mesh。

建议至少语义化以下对象：

```text
Building
Floor
Room
Wall
Door
Window
Column
Slab
Ceiling
Cabinet
Counter
Furniture
Fixture
Light
```

例如点击一个窗户：

```text
┌───────────────────────┐
│ Window W07            │
│                       │
│ Type      Window      │
│ Width     1800 mm     │
│ Height    1500 mm     │
│ Sill       900 mm     │
│                       │
│ Material              │
│ Aluminum + Glass      │
└───────────────────────┘
```

点击墙体：

```text
Wall W13

Length      4200 mm
Height      2800 mm
Thickness    200 mm

Material
Paint / Concrete
```

点击房间：

```text
Living Room

Area:
24.6 m²

Ceiling Height:
2.8 m
```

---

# 14. GLB 与 Metadata 分离

不建议把所有设计数据都塞入 GLB。

建议：

```text
web/
├── house.glb
├── house.meta.json
├── views.json
├── floorplan.json
├── materials.json
└── options.json
```

## house.glb

负责：

```text
Mesh
Material
Texture
Animation
```

---

## house.meta.json

负责：

```json
{
  "W01": {
    "type": "wall",
    "rooms": [
      "living-room",
      "kitchen"
    ]
  },

  "D03": {
    "type": "door",
    "wall": "W05"
  },

  "ROOM01": {
    "type": "room",
    "name": "Living Room",
    "area": 24.6
  }
}
```

---

## views.json

负责：

```text
Camera Presets
Section Presets
Dollhouse Presets
Walkthrough Entry Points
```

---

## floorplan.json

负责：

```text
Room polygons
Wall lines
Door arcs
Window positions
Dimensions
Labels
```

---

# 15. Web 渲染质量

Web Viewer 不需要完全复制 Cycles，但应获得稳定的 PBR 视觉质量。

推荐：

```text
HDRI / Environment
+
PBR Material
+
Lightmap
+
Ambient Occlusion
+
Contact Shadow
+
Tone Mapping
```

---

# 16. PBR Material

每种主要材质至少支持：

```text
Base Color
Roughness
Metallic
Normal
AO
```

根据需要增加：

```text
Transmission
Clearcoat
Emissive
```

住宅常见材质：

- 乳胶漆；
- 木地板；
- 石材；
- 瓷砖；
- 玻璃；
- 金属；
- 木饰面；
- 布料；
- 混凝土。

---

# 17. Lightmap / Baked GI

建筑场景大量元素都是静态的：

```text
Wall
Floor
Ceiling
Built-in Cabinet
Counter
Fixed Furniture
```

因此非常适合：

```text
Blender
   ↓
Bake Global Illumination
   ↓
Lightmap
   ↓
Web
```

优势：

- 浏览器不需要实时计算复杂 GI；
- 室内间接光表现明显提升；
- 性能稳定；
- 移动设备体验更好。

---

# 18. AO 与 Contact Shadow

Web 展示中应特别关注：

```text
墙角
柜体与墙
家具与地面
窗台
踢脚线
门框
台面
```

否则模型会出现明显的：

```text
Floating Objects
```

也就是家具或构件像漂浮在空间中。

---

# 19. Day / Night Mode

住宅特别适合提供：

```text
☀ Day
🌙 Night
```

切换内容可以包括：

```text
Environment Map
Sun Direction
Sun Intensity
Interior Lights
Exposure
Tone Mapping
Lightmap Scenario
```

进一步可以支持：

```text
09:00
12:00
15:00
18:00
```

如果模型拥有：

```text
Location
Building Orientation
Date
```

还可以根据真实太阳位置模拟自然采光。

---

# 20. Material Variant

Web Viewer 可以允许用户修改装修材料：

```text
Floor
├── Oak
├── Walnut
└── Tile

Wall
├── White
├── Warm Gray
└── Beige
```

底层不要修改建筑 Geometry，而只修改：

```text
Material Variant
```

从而实现快速装修方案展示。

---

# 21. Furniture / Layer Visibility

建议支持：

```text
☑ Architecture
☑ Furniture
☑ Decoration
☑ Lighting
☑ Dimensions
☑ Annotation
```

例如用户可以关闭家具：

```text
Furniture OFF
```

查看纯建筑空间。

也可以隐藏：

```text
Ceiling
Roof
Exterior Wall
```

形成不同建筑阅读方式。

---

# 22. Design Option Compare

AI 房屋设计天然会产生多个候选方案：

```text
Option A
Option B
Option C
```

建议网站支持：

```text
[A] [B] [C]
```

并保持：

```text
Camera
Zoom
Angle
Section Plane
```

一致，只替换设计模型。

适合比较：

```text
封闭式厨房
        ↕
开放式厨房

方案 A 卫生间
        ↕
方案 B 卫生间
```

也可以实现 Slider Compare：

```text
Option A ─────────●──────── Option B
```

---

# 23. Measurement

建议 Viewer 原生支持：

```text
Point-to-Point Distance
Wall Length
Room Dimension
Height
Area
```

例如：

```text
Door Width
900 mm

Kitchen Counter
2400 mm

Room Width
4200 mm
```

Measurement 可以基于：

```text
Semantic Geometry
```

而不仅仅是鼠标射线距离。

---

# 24. Annotation

设计说明可以直接绑定空间或对象。

例如：

```text
●
```

点击后：

```text
这里取消隔墙，
改为开放式洗手台。
```

Annotation 数据：

```json
{
  "id": "NOTE_12",
  "target": "W17",
  "position": [2.1, 1.6, 1.2],
  "content": "Remove upper partition wall."
}
```

非常适合设计评审。

---

# 25. IFC / BIM 集成

Web 展示模型推荐以：

```text
GLB
```

为主。

IFC 不负责最终视觉表现，而负责：

```text
Building Semantics
Building Properties
Object Relationships
BIM Exchange
Engineering Data
```

推荐的数据关系：

```text
Semantic House Model
          │
          ├────→ GLB
          │       ↓
          │   Three.js Viewer
          │
          └────→ IFC
                  ↓
              BIM Viewer
```

IFC Viewer 可以独立使用：

```text
xeokit
```

或者：

```text
That Open Components
```

形成：

```text
Presentation Viewer
        │
        └── Three.js

Professional BIM Viewer
        │
        └── xeokit / That Open
```

前者服务：

```text
业主
设计评审
展示
```

后者服务：

```text
工程人员
建筑专业人员
BIM 审阅
```

---

# 26. Web Model Optimization Pipeline

Blender 原始模型不应直接发布。

建议：

```text
Blender
   ↓
GLB Export
   ↓
Geometry Optimization
   ↓
Meshopt / Draco
   ↓
Texture Optimization
   ↓
KTX2 / Basis
   ↓
LOD
   ↓
Web Package
```

---

# 27. Geometry Optimization

包括：

```text
Remove hidden geometry
Merge static mesh
Reuse repeated mesh
Instance furniture
Remove duplicate vertex
Reduce unnecessary polygons
Generate LOD
```

对于重复对象：

```text
Chair
Window
Door
Lamp
Cabinet Module
```

尽量使用：

```text
GPU Instancing
```

而不是复制完整 Mesh。

---

# 28. Texture Optimization

原始：

```text
PNG / JPEG
```

可以根据用途转换为：

```text
KTX2 / Basis Universal
```

目标：

- 降低显存占用；
- 降低下载体积；
- 提升移动设备性能。

---

# 29. Progressive Loading

不要一次加载全部资源。

推荐：

```text
Page Load
   ↓
Hero Render
   ↓
UI
   ↓
Core Architecture GLB
   ↓
Furniture
   ↓
High Resolution Texture
   ↓
Optional BIM Data
```

用户可以在加载高质量资产之前立即开始浏览。

---

# 30. 推荐性能目标

普通住宅可以把目标控制在：

```text
First Screen:
< 1 MB

Viewer JavaScript:
< 3 MB initial target

Initial 3D:
10 ~ 20 MB

Full High Quality Scene:
30 ~ 50 MB
```

实际目标根据项目复杂度调整。

---

# 31. WebGPU 策略

推荐将：

```text
WebGL2
```

作为稳定基础。

WebGPU 作为：

```text
Progressive Enhancement
```

用于：

- 更现代的渲染管线；
- 更复杂的后处理；
- 高级 Shader；
- SSGI 等新能力。

不建议将网站设计成：

```text
WebGPU Only
```

应保留兼容性 fallback。

---

# 32. Website UI

推荐布局：

```text
┌───────────────────────────────────────────────┐
│ Project Name                     Share  Full   │
├───────────────────────────────────────────────┤
│                                               │
│                                               │
│                Interactive 3D                 │
│                                               │
│                                               │
├───────────────────────────────────────────────┤
│ Dollhouse  Plan  Walk  Section  Measure       │
├───────────────────────────────────────────────┤
│ Overall  Living  Kitchen  Bedroom  Bathroom   │
├───────────────────────────────────────────────┤
│ 1F       Furniture   Day/Night   Material     │
└───────────────────────────────────────────────┘
```

核心 UI 应尽量保持简洁。

---

# 33. Mobile Experience

房屋展示网站通常也会在手机查看，因此应专门适配移动端。

桌面：

```text
Mouse Orbit
WASD Walkthrough
Large Property Panel
```

移动：

```text
One Finger Orbit
Two Finger Zoom
Virtual Joystick
Bottom Sheet Property Panel
```

Dollhouse 模式应优先优化触摸体验。

---

# 34. Screenshot / Share

网站可以生成当前 View 的 Share State：

```text
Camera
Section
Floor
Option
Material
Selected Object
```

例如：

```text
/project/house-a
?view=kitchen
&option=B
&section=x
```

用户分享 URL 后可以直接恢复相同设计视图。

也可以自动生成当前 View 的截图。

---

# 35. 数据目录建议

建议项目结构：

```text
house/
│
├── design/
│   ├── house.design.json
│   └── materials.json
│
├── blender/
│   └── house.blend
│
├── renders/
│   ├── hero.webp
│   ├── exterior.webp
│   ├── living.webp
│   ├── kitchen.webp
│   ├── bedroom.webp
│   └── bathroom.webp
│
├── web/
│   ├── house.glb
│   ├── house.meta.json
│   ├── views.json
│   ├── floorplan.json
│   └── options.json
│
├── drawings/
│   ├── floorplan.svg
│   ├── section-a.svg
│   ├── section-b.svg
│   └── elevation.svg
│
└── bim/
    └── house.ifc
```

---

# 36. 自动化 Pipeline

整个最终交付流程应可以由 Codex 自动执行。

```text
Semantic Design Model
        ↓
Generate Blender Scene
        ↓
Geometry Validation
        ↓
Material Assignment
        ↓
Lighting Setup
        ↓
Cycles Rendering
        ↓
GLB Export
        ↓
Web Asset Optimization
        ↓
Generate Metadata
        ↓
Generate Floor Plan
        ↓
Generate Camera Presets
        ↓
Build Web Viewer
        ↓
Screenshot
        ↓
GPT-6 Vision QA
        ↓
Fix
        ↓
Deploy
```

---

# 37. GPT-6 Vision QA

网站构建完成后，不应只运行代码测试，还应进行视觉测试。

自动生成：

```text
Desktop
Tablet
Mobile

Dollhouse
Floor Plan
Walkthrough
Section
Living
Kitchen
Bedroom
```

等截图。

GPT-6 Vision 可以检查：

```text
模型是否穿插
墙体是否消失
门窗是否异常
材质是否错误
房间是否遮挡
镜头构图是否合理
文字是否重叠
移动端 UI 是否挡住模型
Lightmap 是否异常
模型是否悬浮
```

形成：

```text
Code
 ↓
Render
 ↓
Vision
 ↓
Fix
```

闭环。

---

# 38. 建议的技术栈

| 层级 | 推荐技术 |
|---|---|
| AI Reasoning | GPT-6 |
| Agent | Codex |
| Design Source of Truth | JSON / YAML Semantic Model |
| 3D Authoring | Blender |
| Offline Rendering | Cycles |
| Fast Preview | EEVEE |
| Web Runtime | Three.js |
| React Integration | React Three Fiber（可选） |
| Website | React / Next.js |
| Web Model | GLB / glTF |
| Geometry Compression | Meshopt / Draco |
| Texture Compression | KTX2 / Basis |
| BIM | IFC |
| IFC SDK | IfcOpenShell |
| Blender BIM | Bonsai |
| BIM Web Viewer | xeokit / That Open Components |
| Visual QA | GPT-6 Vision |

---

# 39. 核心数据关系

整个系统应尽量维护统一 ID。

例如：

```text
ROOM_LIVING_01
```

同时对应：

```text
Semantic Model
      │
      ├── Blender Collection
      ├── GLB Node
      ├── Floor Plan Polygon
      ├── Web UI
      └── IFC Space
```

墙：

```text
WALL_017
```

对应：

```text
house.design.json
Blender Object
GLB Mesh
house.meta.json
IfcWall
```

门：

```text
DOOR_003
```

对应：

```text
Semantic Door
Blender Object
GLB Node
IfcDoor
```

这会显著提升：

- AI 修改准确性；
- Web 交互能力；
- BIM 转换能力；
- Debug 能力；
- 视觉反馈定位能力。

---

# 40. 最终架构总结

推荐完整技术路线：

```text
                      User
                       │
                       ▼
                  GPT-6 / Codex
                       │
                       ▼
             Semantic House Model
                       │
          ┌────────────┼─────────────┐
          │            │             │
          ▼            ▼             ▼
       Blender       IFC/BIM      Drawings
          │
     ┌────┴─────┐
     ▼          ▼
  Cycles       GLB
     │          │
     │     Optimization
     │          │
     └────┬─────┘
          ▼
      Web Platform
          │
 ┌────────┼─────────────┬─────────────┐
 ▼        ▼             ▼             ▼
Hero   Dollhouse    Floor Plan   Walkthrough

 ┌────────┼─────────────┬─────────────┐
 ▼        ▼             ▼             ▼
Section  Material     Measure      BIM Data

          │
          ▼
     GPT-6 Vision QA
          │
          └──────────────→ Codex
```

最终网站不是单纯：

> **“一个在线 3D 模型”**

而应成为：

> **AI 房屋设计系统最终的交互式数字交付物。**

其中：

- **Cycles** 负责高质量视觉；
- **Three.js** 负责实时空间交互；
- **GLB** 负责 Web 3D 资产；
- **Semantic Model** 负责设计数据；
- **IFC** 负责建筑专业交换；
- **GPT-6 + Codex** 负责生成、维护、验证与自动化；
- **GPT-6 Vision** 负责最终视觉质量闭环。

这样可以同时兼顾：

```text
视觉质量
空间理解
交互体验
设计可解释性
AI 可维护性
工程扩展性
Web 性能
专业数据兼容
```
