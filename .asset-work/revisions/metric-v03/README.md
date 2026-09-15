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
- `art_src/apartment-v03.blend`：米制完整高度源场景；v01、v02 源文件保留。
- `public/models/apartment-v03.glb`：实际浏览器加载的同源模型，保留独立构件及 layer/room 元数据；文件版本由规格的 assetStem 指定。
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

当前 metric-v03 按本轮照片重建了客厅壁龛柜、东西向宽玻璃推拉门和厨房 U 形柜台，补齐冰箱、三眼灶、斜面烟机、烤箱及下嵌水槽；外置台盆水龙头移至靠墙侧。南侧客厅为落地玻璃，卧室和 X 空间窗台暂设 280 mm，所有窗栏移除。灰色石纹地面、灰褐木饰面、米白橱柜和暖光使用同一材质体系。

选择客厅、厨房或 X 空间后，可点击“客厅柜”“烟机灶具”“冰箱水槽”“北侧推拉门”直接查看细节。尺寸链和住宅墙参考线保持原位；外部电梯间与此前删除的柜体仍不显示。修订前资料保存在 `.asset-work/revisions/metric-v02/`，本次素材与原始提示词见 `references/generated/materials-v03-provenance.json`。
