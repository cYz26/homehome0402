# 户型 3D 预览

已确认的 v05 外观参考，转为米制 Blender 场景与本地浏览器查看器。几何基准为原始户型图；图片不承担测量。当前为可核对布局与精装分区的基础模型，未达到实测施工模型或实景摄影一致的最终精装验收。

## 查看

```sh
npm ci
npm run dev
```

正式构建：`npm run build`；本地查看构建产物：`npm run preview -- --port 4173`。服务仅绑定本机，不上传户型或照片。

- 立体：拖动旋转、滚轮缩放、右键拖动平移。
- 俯视：固定北向，可以打开尺寸链与房间标签。
- 室内：选择左侧房间切换机位，拖动转头，滚轮调整视野，方向键转头。当前是定点观景，不是带碰撞的自由行走。
- 参考图：查看已确认 v05、原图、早期实景与最新柜体、推拉门、厨房参考照片。
- 尺寸依据：区分图纸尺寸链与暂估墙厚、洞口、净高。
- 复位：回到全屋斜俯瞰。窄屏通过“空间”按钮打开房间列表。

## 可编辑文件

- `model/apartment.json`：尺寸链、高度、轮廓、机位与暂估清单。
- `scripts/build-apartment.py`：从规格生成墙体、开口、地板、门窗、厨卫、吊顶，保存独立构件与显示层。
- `art_src/apartment-v04.blend`：米制完整高度源场景；v01、v02、v03 源文件保留。
- `public/models/apartment-v04.glb`：实际浏览器加载的同源模型，保留独立构件及 layer/room 元数据；文件版本由规格的 assetStem 指定。
- `src/viewer.js`：Three.js 查看器；俯瞰隐藏 upper/ceiling，室内恢复真实 2.80 m 主顶高度。
- `docs/dimension-status.md`、`docs/QA.md`：尺寸状态、验证及外观限制。

坐标采用图纸 x 向东、t 向南；Blender 使用 `(x,12.9-t,z)`，GLB 使用 `(x,z,t-12.9)`。图纸基准点、墙中心参考线和饰面厚度分别记录。外墙及内墙厚度暂估，不因薄包边要求缩小结构。

## 重建与核对

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python scripts/build-apartment.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python scripts/validate-apartment.py
npm run check:model
npm run build
```

Blender 5.2.1 LTS 已用于本次生成。渲染使用 Blender 内置 Python / NumPy；纹理由内置 image_gen 生成，原图与提示词在 `references/generated/material-*.png` 和相邻 `*-prompt.txt`。

Blender Assets doctor 已确认专用 workspace、锁定 Python 环境和离线 Blender 可用。本项目保持建筑图纸原点、透明玻璃和分层构件，因此采用项目内独立重导入核对；未把插件限定为不透明且底部居中的通用道具合同套用到建筑模型，也未声称生成过插件封存交付包。

后续精修可直接修改尺寸表与建模脚本，再从同一模型导出。未来家具软装需新建独立层，不覆盖本轮空房基础。

当前 metric-v04 根据新照片将北侧门扇框厚调整为约 22 mm，停放组总厚约 96 mm；X 空间和厨房的门洞补齐深色外围边框。次卫门改为薄深色门扇，主卫新增同类推拉门，停放于原门洞右侧。主卫为 1.80 m 一体石材宽槽、两组墙出龙头、悬浮抽屉柜和镜柜。

客厅柜及周边短墙更新为柔和灰褐木纹，壁龛采用灰绿石材、暖灯带及细晶石饰条。此前的厨房设备、低窗台、无栅栏窗户、素墙、空房与空置凹位保留。全屋墙体及门窗洞口与 v03 一致。

选择“主卫”可点击“双人洗手台”或“主卫推拉门”；客厅、厨房和 X 空间保留原有四个细节机位。“参考图”已加入本轮照片。浏览器主卫镜面使用 1024 × 1024 平面反射；GLB / Blender 源文件保留对应的金属镜面材质，浏览器照明与反射需单独核对。

19 项模型检查通过；实际 GLB 独立重导入与源场景一致。v03 配方和报告在 `.asset-work/revisions/metric-v03/`，新纹理与提示词见 `references/generated/materials-v04-provenance.json`。当前门窗、柜体细部仍属照片估读，推拉门为静态开启状态。
