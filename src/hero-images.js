// Keep the homepage on the selected designs and complete interior views.
// Site photos, drawings, saved alternatives and cutaway views stay elsewhere.
const selections = [
  ["scheme-overview", "客餐厅 · 整体效果"],
  ["living", "客厅 · 场景图"],
  ["scheme-tv-c-close", "电视墙 · 正面效果"],
  ["scheme-study", "书房 · 整体效果"],
  ["study", "书房 · 场景图"],
  ["scheme-study-cabinet", "书房 · 柜体近景"],
  ["study-cabinet", "书柜 · 场景图"],
  ["kitchen", "厨房 · 场景图"],
  ["master", "主卧 · 场景图"],
  ["masterbath", "主卫 · 场景图"],
];

export function homepageImages(manifest) {
  return selections.flatMap(([id, title]) => {
    const image = manifest.images.find((image) => image.id === id);
    if (!image || !(image.kind === "模型渲染" || image.kind.startsWith("AI")))
      return [];
    return [{ ...image, title, label: image.kind === "模型渲染"
      ? "模型渲染 · Cycles" : "AI 效果图 · 方案示意" }];
  });
}
