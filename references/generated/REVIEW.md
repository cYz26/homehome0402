# 精装空房参考图 · v05 已确认

当前候选：[house-cutaway-v05.png](/Users/cy/Dev/homehome/references/generated/house-cutaway-v05.png)。使用内置 image_gen 生成；v01 使用原始五图，v02 使用 v01、原始户型图和客厅照片作局部修订，v03–v05 分别根据用户标注编辑上一版。没有生成可编辑 3D 模型。

## v05：次卫门、家政凹位及客厅墙面

标注原件：[house-cutaway-v04-user-markup.png](/Users/cy/Dev/homehome/references/generated/house-cutaway-v04-user-markup.png)。用户通过标注要求四项修订：

- 次卫有推拉门。首轮生成将门误画到淋浴隔断处，因此保留为 v05-draft，再单独补做次卫入口门。当前候选在上方马桶区域东侧显示有拉手的推拉门扇示意。真实轨道、收纳方向、门框和洞口尺度仍需在 3D 模型中明确，不能按这张图的像素确定。
- 西北次卧门的问题继续修复。当前门扇改为朝卧室内部开启，并与右侧门框连接，去掉脱离墙体的门扇观感。
- 厨房南侧、入户门北侧的家政凹位内部为空。当前已移除白色设备，露出凹位地面和内墙。此处与此前清空的电梯西侧玄关库是两个空间，两者均保持空置。
- 客厅两侧墙面的包覆去掉。当前客厅西侧和东侧内墙均为平整浅色墙面，原贴面及纵向灯带不再保留；实际分隔墙仍保留。

已目视比较当前结果。此前主卧去柜、东南卧室东墙去包覆、北侧多余隔板移除、薄包边以及 X 空间推拉门收起的要求继续继承。用户以“这一版OK了，继续推进”确认 v05；它作为外观基准，尺寸仍由原户型图和米制模型负责。

完整提示词：[四项修改](/Users/cy/Dev/homehome/references/generated/house-cutaway-v05-prompt.txt)、[次卫推拉门补修](/Users/cy/Dev/homehome/references/generated/house-cutaway-v05-bathroom-fix-prompt.txt)。

## v04：第二轮用户标注与薄包边

标注原件：[house-cutaway-v03-user-markup.png](/Users/cy/Dev/homehome/references/generated/house-cutaway-v03-user-markup.png)。本轮用户明确要求及目视检查：

- 正北 X 空间推拉门收起。结果在右侧显示窄门扇叠放，大部分入口宽度敞开。
- 西北次卧门与墙体原有断开感需修复。结果已显示门框与墙体短返边相接；真正铰链和洞口几何仍需模型中验证。
- 电梯西侧玄关库内部为空。结果已去掉填满空间的柜体表面，露出石纹地面及内墙。
- 去掉主卧入口旁箭头所指的横向突出构件。结果已去除叠层突出条，保留实际门扇与墙体。
- 所有墙面包边薄一些。结果将宽深色边收成明显更细的边线；该视觉变化不作为结构墙厚变更依据。

以上修订需要进入后续建模约束。v03 已落实的主卧去柜、指定次卫淋浴、东南卧室东墙去包覆、北侧三处去多余隔板继续保留。用户对 v04 的确认待收到。

尺寸答复：目前各房间没有米制几何，也没有逐室尺寸验收，不能认为生成图已与户型尺寸严格一致。原图南侧宽度分段为主卧 3.5 m / 客厅 4.0 m / 东南卧室 3.0 m；北侧为次卧 2.8 m / X 空间 2.8 m / 厨房 2.6 m，另有两侧退进分段。这里的分段不是自动扣除墙厚后的净开间。更多原图依据和后续校准方法见 [尺寸核对记录](/Users/cy/Dev/homehome/docs/dimension-status.md)。

v04 完整提示词：[house-cutaway-v04-prompt.txt](/Users/cy/Dev/homehome/references/generated/house-cutaway-v04-prompt.txt)。

## v03：用户标注修订

标注原件：[house-cutaway-v02-user-markup.png](/Users/cy/Dev/homehome/references/generated/house-cutaway-v02-user-markup.png)。以下用户明确修订优先于此前生成图中推断的构件，后续 3D 建模需要继承：

- 北侧三处多余的贴墙长隔板去掉，实际结构墙和房间分隔保留。生成结果中这些墙面已表现为单层平整墙面。
- 主卧标框内柜体全部移除。生成结果中西侧长柜和北侧 L 形柜体已去掉，地面延续人字拼。
- 箭头所指次卫区域为淋浴间。该位置在结果中已显示花洒、玻璃和淋浴地面；相邻马桶、外置台盆保持原位置。
- 东南卧室东侧标注墙面的包覆装饰去掉。结果中为平整浅色墙面，原竖向发光装饰和装饰分格已移除。

已目视检查以上四项；用户对 v03 的最终确认仍待收到。本轮为参考图编辑，不是已完成实体 3D 构件修改。

v03 完整提示词：[house-cutaway-v03-prompt.txt](/Users/cy/Dev/homehome/references/generated/house-cutaway-v03-prompt.txt)。

## v02 历史观察及仍适用的精度范围

本次看图观察：

- 北排次卧、X 空间、厨房和南排主卧、客厅、东南卧室的基本相邻关系已表现；西侧两个卫生间和东侧电梯井分别可见。
- 空房状态、公共区石纹地面、主卧人字拼、东南卧室直铺木地板和暖浅色饰面已表现。
- v01 将客厅画得偏窄；v02 调整了南侧分隔和窗框，但南侧 3.5 : 4 : 3 的宽度比例仍未严格达到。不能沿生成图描线建模，应回到原图尺寸链。
- 该俯瞰图采用去顶、切墙展示；无法凭此验收实际 2.8 m 高度、完整南窗立面、墙面分格与柜体正立面。
- 未拍摄的卧室和卫浴、部分柜体以及门扇开合含推断，需要后续 review。玄关和厨房周边细部也不视为实测还原。

适用：讨论整体色调、材质方向和空房精装表达。用户尚未确认此候选。

提示词原文：[首轮](/Users/cy/Dev/homehome/references/generated/house-cutaway-v01-prompt.txt)、[局部修订](/Users/cy/Dev/homehome/references/generated/house-cutaway-v02-prompt.txt)。生成与文件校验记录见 [generation-record.json](/Users/cy/Dev/homehome/references/generated/generation-record.json)。
