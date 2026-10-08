# Tripo 沙发接入交接 · 2026-10-08

用户要求替换 3D 场景中的沙发，随后明确授权将已处理模型发给主线程接入。侧对话只准备沙发独立资产；主线程负责当前场景、建模生成器、发布清单及网页验证，避免同时覆盖正在修改的灯光/材质。

可直接接入的自包含源：`art_src/furniture/sofa-tripo-r1-ready.blend`，对象 `Furniture_living_sofa`，材质 `Tripo_sofa_original_PBR`。独立导出为 `asset_exchange/sofa-tripo-r1/sofa-ready.glb`。这些 GLB 是 Blender 派生物，供应压缩包中没有原始 GLB。

源轴已校正：正面 +X、宽度 +Y、高度 +Z；原点位于地面、XY 居中。保持场景平面位置 `[4.12, 10.4]` 与正面 `[1, 0]`，即沙发朝向柜墙。宽度按既有 2.4 m 假设做等比缩放，派生模型实际为约 2.40006 × 1.10178 × 0.96261 m；这些不是实测家具尺寸。石材完成面标高沿当前场景采用 0.016 m。

原模型 1,941,920 个三角面；网页候选 149,999 面。原始 ZIP/FBX/五张 4K 贴图、导入检查以及完整密度的 packed source 均保留。候选材质保留 4K Base Color、Metallic、Roughness、Normal，GLB 将 Metallic/Roughness 合并到标准通道。没有重画贴图或降分辨率。独立 GLB 重导入面数一致、包围尺寸最大差 0；目标网页的视觉/剖切/查询/漫游与真机性能仍待主线程检验。

原始与候选的同机位实际 Cycles 预览已查看，主要软包形体、三座分区、一个放平的头枕和木框保留；见 `references/model/sofa-tripo-r1/full-source.png` 与 `runtime-source.png`。细节统计、SHA-256、输入关系与来源限制见同目录 handoff.json 和 asset_exchange/sofa-tripo-r1/ready-report.json。

需要从设计源绑定外部模型，避免只替换派生 GLB 被下次重建覆盖。保留稳定逻辑 ID，采用实际网格尺寸更新构件属性和碰撞。材质应使用导入的原始 PBR，而非原先的程序化沙发材质。

独立 GLB 21,232,036 bytes。整体合并会增加资源量，当前网页预算与 Workers 单文件 25 MiB 限制需要在主线程按实际打包结果核对。模型生成参数、供应 task id、上传图及费用均未知，不从文件名推断。

本轮没有写入共享 model/apartment.json、furniture_geometry.py、网页或发布清单，没有提交、推送、发布，也未删除用户 Downloads 原始 ZIP。准备脚本副本位于 asset_exchange/sofa-tripo-r1/preparation-scripts/。


## 提交归档与独立恢复

原 ZIP 和所有 packed Blend 源 / GLB 保留在仓库；`.asset-work/sofa-tripo-r1/` 工作截图、临时脚本和起始状态备份仅保留本机缓存。可审查的正式预览位于 `references/model/sofa-tripo-r1/`，准备脚本保留在 `asset_exchange/sofa-tripo-r1/preparation-scripts/`。

FBX 与五张原始材质图完整保存在原 ZIP，解压目录 `asset_exchange/sofa-tripo-r1/original/` 是可恢复缓存，不重复提交，以保留原始字节而不改写材质。需要从原始输入重做准备时执行：

```sh
python3 asset_exchange/sofa-tripo-r1/preparation-scripts/restore-intake.py
```

此入口核对压缩包与各成员的原 SHA-256，拒绝覆盖已变化的原始文件。当前整屋重建直接使用锁定 ready Blend，不需要恢复 FBX。元数据清理仅涉及五张生成参考及检查图的项目副本，不改变原始 ZIP、packed 源或 GLB 材质，审计见 `production/privacy-publication-20261008.json`。
