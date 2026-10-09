# 85 寸电视墙与卧室门洞 · 三柜型对照

最新依据是用户红框实拍：黑色长条为电视墙侧立面，卧室门洞在它旁边。三图共用灰米竖缝墙、窗側石材与暖光缝，并以当前实际模型的斜向机位为基础。使用内置 image_gen；摄影透视和柜体比例存在生成近似，图片不是实拍、施工图或同源模型渲染。

| 方案 | 最新效果图 | 柜体关系 |
| --- | --- | --- |
| A | [单门立柜＋低位悬空柜](cabinet-a-single-door-r2.png) | 暂设 45 cm 宽、40 cm 深单门柜；下柜底离完成地面约 12 cm、顶约 42 cm；当前 3D 为此柜型 |
| B | [高低组合柜](cabinet-b-combination-door-r2.png) | 中间三个低抽屉模块，左端开放格 / 玻璃柜，右端较高玻璃展示模块；保留用户组合柜形式 |
| C | [一字悬空柜](cabinet-c-floating-door-r2.png) | 去掉整高立柜，低位长柜止于窗侧灯缝之前，侧立面与门洞露出更完整 |

电视按用户要求设为 85 寸；真实模型可视区约 1.882 × 1.058 m。两组实拍插座按同高、横三联＋单面板布局保留在柜后，未移到柜下；柜后服务空腔和可拆背板用于检修预留。精确柜体 / 插头与现场尺寸尚未核对。

当前模型与源决策见 [living-v06](../../../docs/design/living-v06/DECISION.md)，实际画面见 [门洞斜视](../../model/metric-v11/tv-door-cycles.png)、[正对墙面](../../model/metric-v11/cabinet-cycles.png)及[客餐厅整体](../../model/metric-v11/living-cycles.png)。具体柜型仍待用户选择，B / C 只作效果对照，没有建立多方案模型切换。

最终提示词：[A](prompts/cabinet-a-single-door-r2.txt)、[B](prompts/cabinet-b-combination-door-r2.txt)、[C](prompts/cabinet-c-floating-door-r2.txt)。输入、原输出、像素不变的元数据清理、各轮来源与 SHA-256 见 [generation-record.json](generation-record.json)和 [intake.json](../../revisions/tv-wall-20261009/intake.json)。早期双门独立图、白门套 / 宽黑正面条的对照图保留为历史，不进入当前图廊。
