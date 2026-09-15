import "./style.css";
import { fetchResource } from "./resources.js";
import { decodeView, encodeView } from "./view-state.js";
const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const url = (path) => import.meta.env.BASE_URL + path;
let manifest,
  data,
  viewer,
  loading,
  loadPromise,
  configPromise,
  sequence = 0,
  observer,
  saveTimer,
  messageTimer,
  referenceId = "reference",
  lastProperties = "",
  restoring = false;
const modelPlaceholder = $("#model-placeholder");
function notify(message, error = false) {
  $("#viewer-message").textContent = message;
  $("#viewer-message").hidden = false;
  clearTimeout(messageTimer);
  if (!error)
    messageTimer = setTimeout(() => {
      $("#viewer-message").hidden = true;
    }, 7000);
}
function imageById(id) {
  return manifest.images.find((i) => i.id === id);
}
function showImage(image) {
  const el = $("#reference-image");
  el.dataset.retryUrl = url(image.path);
  el.src = url(image.path);
  el.alt = image.title;
  $("#reference-caption").textContent =
    `${image.kind} · ${image.version}　${image.caption}`;
  document
    .querySelectorAll("[data-reference]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.reference === image.id)),
    );
}
async function openReference(id = "reference") {
  await configPromise;
  if (!manifest) return;
  referenceId = id;
  showImage(imageById(id) ?? imageById("reference"));
  if (!$("#reference-dialog").open) $("#reference-dialog").showModal();
}
const formatSize = (bytes) =>
  bytes >= 1024 ** 2
    ? `${(bytes / 1024 ** 2).toFixed(1)} MiB`
    : `${Math.ceil(bytes / 1024)} KiB`;
function populate() {
  $("#rooms").innerHTML = data.rooms
    .map(
      (r) =>
        `<button data-room="${r.id}" aria-pressed="false">${escape(r.name)}</button>`,
    )
    .join("");
  $("#assumptions").innerHTML = data.assumptions
    .map((s) => `<li>${escape(s)}</li>`)
    .join("");
  $("#reference-tabs").innerHTML = manifest.images
    .filter(
      (i) => !["living", "master", "kitchen", "masterbath"].includes(i.id),
    )
    .map((i) => `<button data-reference="${i.id}">${escape(i.title)}</button>`)
    .join("");
  const descriptions = {
    living: "公共空间以连续石纹地面相连，南侧整面玻璃引入自然光。",
    master: "人字拼橡木与温和墙面，保留空房的完整尺度。",
    kitchen: "西侧冰箱、北侧水槽、东侧烟机灶具，让 U 形动线清晰可见。",
    masterbath: "连续一体宽槽、双组墙出龙头与镜柜，细节对应实拍修订。",
  };
  $("#space-cards").innerHTML = ["living", "kitchen", "master", "masterbath"]
    .map((id, i) => {
      const image = imageById(id),
        room = data.rooms.find((r) => r.id === id);
      return `<article class="space-card"><a href="#explore" data-room-jump="${id}"><figure><img src="${url(image.path)}" width="1100" height="756" loading="lazy" decoding="async" alt="${escape(room.name)}的当前模型渲染"><span class="image-badge">模型渲染 · Cycles · v06</span></figure></a><header><h3>${escape(room.name)}</h3><small>0${i + 1} / ${room.area.toFixed(2)} m² · 模型估算</small></header><p>${descriptions[id]}</p><a class="text-link" href="#explore" data-room-jump="${id}">进入这个空间 ↗</a></article>`;
    })
    .join("");
  $("#material-cards").innerHTML = [
    [
      "photo-hall",
      "灰褐木饰面，温润的层次",
      "壁龛展示柜以细分格、灰绿石材与暖色灯带组合，相邻长墙保持素面。",
      "hall",
    ],
    [
      "photo-vanity",
      "一体宽槽，连贯的线条",
      "连续石材长槽配两组墙出龙头，悬空抽屉柜与镜柜共同收纳。",
      "double-basin",
    ],
    [
      "photo-fridge",
      "三面台面，顺手的动线",
      "冰箱与高柜嵌在西侧，水槽落在北窗下，台面沿三面墙连续布置。",
      "fridge",
    ],
  ]
    .map(([id, title, description, detail]) => {
      const image = imageById(id);
      return `<article class="material-card"><figure><img src="${url(image.path)}" width="700" height="540" loading="lazy" alt="${escape(image.title)}"><figcaption>${escape(image.kind)} · 材质与细节依据</figcaption></figure><h3>${title}</h3><p>${description}</p><button class="text-link" data-detail-jump="${detail}">查看三维细节 ↗</button></article>`;
    })
    .join("");
  const downloads = [
    [manifest.floorplan, "模型派生平面图", "SVG · 房间 / 门窗 / 尺寸 / 比例尺"],
    [manifest.rawModel, "高清原始模型", "GLB · 原始纹理 · 按需下载"],
    [manifest.spec, "可编辑建筑规格", "JSON · 尺寸、构件、材质与机位"],
    [
      manifest.architecture,
      "空间与构件属性",
      "JSON · 稳定构件 ID 与模型估算面积",
    ],
    [manifest.report, "交付验证记录", "JSON · 版本、摘要、重导入与保留检查"],
    ["release.json", "当前发布清单", "JSON · 文件路径、大小与 SHA-256"],
  ];
  $("#downloads").innerHTML = downloads
    .map(
      ([path, title, description]) =>
        `<a class="download" href="${url(path)}" download><div><h3>${title}</h3><p>${description}${manifest.assets.find((a) => a.path === path) ? " · " + formatSize(manifest.assets.find((a) => a.path === path).bytes) : ""}</p></div><span aria-hidden="true">↓</span></a>`,
    )
    .join("");
  $("#inspector-panel").open = !matchMedia("(max-width:700px)").matches;
}
async function initialize() {
  try {
    $("#site-status").hidden = true;
    manifest = await fetchResource(url("release.json"));
    data = await fetchResource(url(manifest.architecture));
    if (data.version !== manifest.version)
      throw Error("模型与属性版本不一致，请重新加载。");
    populate();
    const svg = await fetchResource(url(manifest.floorplan), { type: "text" });
    const documentSVG = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (documentSVG.querySelector("parsererror,script,foreignObject"))
      throw Error("平面图格式不正确");
    const plan = document.importNode(documentSVG.documentElement, true);
    plan.setAttribute("role", "group");
    plan.querySelectorAll("[data-entity-id]").forEach((element) => {
      const entity = data.entities.find(
        (e) => e.id === element.dataset.entityId,
      );
      element.setAttribute("role", "button");
      element.setAttribute("tabindex", "0");
      element.setAttribute(
        "aria-label",
        entity?.name ?? element.dataset.entityId,
      );
    });
    $("#mini-plan").replaceChildren(plan);
    const restored = decodeView(location.hash, data);
    observer?.disconnect();
    if (restored) {
      setTimeout(async () => {
        $("#explore").scrollIntoView();
        const v = await loadModel();
        if (v) {
          restoring = true;
          v.restore(restored);
          restoring = false;
        }
      }, 0);
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer.disconnect();
            loadModel();
          }
        },
        { threshold: 0.12 },
      );
      observer.observe($("#stage"));
    }
  } catch (error) {
    manifest = null;
    data = null;
    $("#site-status p").textContent = `项目资料暂时无法读取。${error.message}`;
    $("#site-status").hidden = false;
  }
}
function sync(state) {
  if (!viewer) return;
  const direction = state.camera.target.map(
    (n, i) => n - state.camera.position[i],
  );
  $("#north-arrow").style.transform =
    `rotate(${(-Math.atan2(direction[0], -direction[2]) * 180) / Math.PI}deg)`;
  $("#viewer-shell").dataset.mode = state.mode;
  $("#viewer-shell").dataset.room = state.roomId ?? "";
  $("#viewer-shell").dataset.entity = state.entityId ?? "";
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode)),
    );
  document
    .querySelectorAll("[data-room]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String((b.dataset.room || null) === state.roomId),
      ),
    );
  $("#mini-plan")
    .querySelectorAll("[data-room-id]")
    .forEach((g) =>
      g
        .querySelector(".room")
        ?.classList.toggle("selected", g.dataset.roomId === state.roomId),
    );
  $("#mini-plan")
    .querySelectorAll("[data-entity-id]")
    .forEach((g) =>
      g.classList.toggle("selected", g.dataset.entityId === state.entityId),
    );
  $("#quality").value = state.quality;
  $("#section-axis").value = state.section.axis;
  $("#section-range").max =
    state.section.axis === "x"
      ? 10.6
      : state.section.axis === "y"
        ? 13
        : data.height;
  $("#section-range").value = state.section.value;
  $("#section-range").disabled = state.section.axis === "off";
  $("#section-value").textContent =
    state.section.axis === "off"
      ? "完整"
      : `${state.section.value.toFixed(2)} m`;
  $("#eye-height").hidden = state.mode !== "walk";
  $("#eye-height").textContent = `视线 ${state.eyeHeight.toFixed(2)} m`;
  const small = matchMedia("(pointer:coarse)").matches || innerWidth < 700;
  $("#gesture-hint").textContent =
    state.mode === "walk"
      ? small
        ? "滑动环顾 · 按住前进 · 双指按住上下滑调高度"
        : "拖动环顾 · WASD 移动 · Q 降 / E 升 · Esc 退出"
      : state.mode === "interior"
        ? "单指或鼠标拖动环顾 · 选择房间切换机位"
        : small
          ? "单指旋转 · 双指缩放 / 平移 · 短按选择"
          : "拖动旋转 · 滚轮缩放 · 右键平移 · 点击查询";
  const key = `${state.roomId}:${state.entityId}`;
  if (key !== lastProperties) {
    const oldEntity = lastProperties.split(":")[1];
    lastProperties = key;
    const room = viewer.room,
      entity = viewer.entity;
    $("#inspector-summary").textContent =
      entity?.name ?? room?.name ?? "空间与构件";
    const roomName = (id) => data.rooms.find((r) => r.id === id)?.name ?? id;
    const labels = {
      Warm_white_plaster: "暖白墙面",
      Warm_white_ceiling: "暖白吊顶",
      Ivory_stone_counter: "浅色石材",
      Graphite_frame: "深灰金属框",
      Clear_glass: "玻璃",
      Black_appliance_glass: "电器黑色玻璃",
      Brushed_steel: "拉丝金属五金",
      Champagne_crystal_inlay: "香槟色晶石饰条",
      Charcoal_bath_privacy_glass: "深灰隐私玻璃",
      Dark_stainless_sink: "深色不锈钢水槽",
      Grey_flowing_marble_floor: "灰色纹理石材地面",
      Grey_olive_niche_stone: "灰绿壁龛石材",
      Kitchen_satin_stone: "厨房柔光石材",
      Muted_taupe_hall_panels: "灰褐木饰面",
      Pale_sage_marble_vanity: "浅灰绿台盆石材",
      Pearl_ivory_refrigerator: "珍珠白冰箱面板",
      Porcelain: "瓷质洁具",
      Silver_mirror: "银色镜面",
      Smoked_ribbed_sliding_glass: "烟灰长虹玻璃",
      Subtle_glass_fluting: "玻璃细纹",
      Taupe_wood_joinery: "灰褐木作",
      Thin_graphite_cut_edge: "深灰收边",
      Warm_ivory_cabinet: "暖白柜体",
      Warm_light: "暖色灯带",
    };
    const materialNames = entity
      ? [
          ...new Set(
            entity.materials.map((m) =>
              m.startsWith("Oak_plank_")
                ? "橡木地板"
                : (labels[m] ?? m.replaceAll("_", " ")),
            ),
          ),
        ].join("、")
      : "";
    if (entity)
      $("#properties").innerHTML =
        `<h3>${escape(entity.name)}</h3><p class="component-id">${escape(entity.id)}</p><dl><div><dt>关联空间</dt><dd>${escape(entity.roomIds.map(roomName).join("、"))}</dd></div><div><dt>模型外包尺寸</dt><dd>${entity.size[0].toFixed(2)} × ${entity.size[2].toFixed(2)} × ${entity.size[1].toFixed(2)} m</dd></div>${entity.wall ? `<div><dt>墙厚</dt><dd>${entity.wall.thickness.toFixed(2)} m</dd></div>` : ""}${entity.door ? `<div><dt>门扇宽度</dt><dd>${entity.door.width.toFixed(2)} m · 全开</dd></div>` : ""}${entity.window ? `<div><dt>窗宽 / 窗台高</dt><dd>${entity.window.width.toFixed(2)} / ${entity.window.sill.toFixed(2)} m</dd></div>` : ""}<div><dt>材质</dt><dd>${escape(materialNames)}</dd></div></dl><p>${escape(entity.basis)}</p>${entity.annotations.map((a) => `<p>${escape(a.content)}</p>`).join("")}`;
    else if (room)
      $("#properties").innerHTML =
        `<h3>${escape(room.name)}</h3><dl><div><dt>空间面积</dt><dd>${room.area.toFixed(2)} m² · 模型估算</dd></div></dl><p>${escape(room.finish)}</p><p>${escape(room.drawing)}</p><p>${escape(room.areaLabel)}</p>`;
    else
      $("#properties").innerHTML =
        "<h3>选择一处，了解更多</h3><p>点击平面图中的房间，或模型中的墙、门窗和柜体。</p>";
    $("#detail-views").innerHTML = data.detailViews
      .filter((v) => v.room === state.roomId)
      .map((v) => `<button data-detail="${v.id}">${escape(v.name)}</button>`)
      .join("");
    if (entity && entity.id !== oldEntity && innerWidth < 700)
      $("#inspector-panel").open = true;
  }
  if (!restoring) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (viewer) history.replaceState(null, "", encodeView(viewer.snapshot()));
    }, 600);
  }
}
async function loadModel({ force = false, hd = false } = {}) {
  if (viewer && !force && !hd && !modelPlaceholder.hidden) return loadPromise;
  if (viewer && !force && !hd && modelPlaceholder.hidden) return viewer;
  if (loadPromise && !force && !hd) return loadPromise;
  const operation = ++sequence,
    previous = viewer?.snapshot();
  observer?.disconnect();
  loading?.abort();
  if (viewer) {
    viewer.onChange = null;
    viewer.dispose();
    viewer = null;
  }
  loading = new AbortController();
  const signal = loading.signal;
  modelPlaceholder.hidden = false;
  $("#loading-text").textContent = "正在准备空间数据…";
  $("#load-model").hidden = true;
  $("#cancel-model").hidden = false;
  const task = (async () => {
    try {
      await configPromise;
      if (!manifest || !data) throw Error("项目资料未就绪，请先重试资料加载。");
      const [module, navigation] = await Promise.all([
        import("./viewer.js"),
        fetchResource(url(manifest.navigation), { signal }),
      ]);
      signal.throwIfAborted();
      if (navigation.version !== data.version)
        throw Error("导航数据与模型版本不一致。");
      viewer = new module.ApartmentViewer(
        $("#canvas-container"),
        data,
        navigation,
        sync,
        notify,
      );
      const current = viewer;
      await current.load(
        hd ? { ...manifest, model: manifest.rawModel } : manifest,
        signal,
        (loaded, total) => {
          $("#loading-text").textContent =
            `正在载入${hd ? "高清" : "网页"}模型 ${total ? Math.round((loaded / total) * 100) + "%" : formatSize(loaded)}…`;
        },
      );
      if (operation !== sequence) return null;
      modelPlaceholder.hidden = true;
      $("#cancel-model").hidden = true;
      $("#load-model").hidden = false;
      if (previous) current.restore(previous);
      sync(current.snapshot());
      return current;
    } catch (error) {
      if (operation !== sequence) return null;
      if (viewer) {
        viewer.onChange = null;
        viewer.dispose();
        viewer = null;
      }
      $("#loading-text").textContent =
        error.name === "AbortError"
          ? "加载已取消，随时可以继续。"
          : `3D 暂时无法载入。${error.message}`;
      $("#load-model").textContent = "重试载入 3D";
      $("#load-model").hidden = false;
      $("#cancel-model").hidden = true;
      return null;
    } finally {
      if (operation === sequence) loadPromise = null;
    }
  })();
  loadPromise = task;
  return task;
}
function download(blob, name) {
  const href = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
$("#load-model").addEventListener("click", () => loadModel());
$("#cancel-model").addEventListener("click", () => loading?.abort());
$("#retry-site").addEventListener("click", () => {
  configPromise = initialize();
});
$("#reload-model").addEventListener("click", () => loadModel({ force: true }));
$("#load-hd").addEventListener("click", () =>
  loadModel({ force: true, hd: true }),
);
$("#reset").addEventListener("click", () => viewer?.reset());
$("#quality").addEventListener("change", (e) =>
  viewer?.setQuality(e.target.value),
);
$("#section-axis").addEventListener("change", (e) =>
  viewer?.setSection(
    e.target.value,
    e.target.value === "z" ? 1.15 : e.target.value === "x" ? 5.25 : 6.45,
  ),
);
$("#section-range").addEventListener("input", (e) =>
  viewer?.setSection($("#section-axis").value, Number(e.target.value)),
);
$("#section-reset").addEventListener("click", () =>
  viewer?.setSection("z", 1.15),
);
$("#dimensions-info").addEventListener("click", () =>
  $("#dimensions-dialog").showModal(),
);
$("#share").addEventListener("click", () => {
  if (!viewer) return;
  const link = new URL(location.href);
  link.hash = encodeView(viewer.snapshot());
  $("#share-url").value = link.href;
  $("#share-result").textContent = "";
  $("#share-dialog").showModal();
});
$("#copy-link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#share-url").value);
    $("#share-result").textContent = "链接已复制。";
  } catch {
    $("#share-url").focus();
    $("#share-url").select();
    $("#share-result").textContent = "请复制已选中的链接。";
  }
});
$("#screenshot").addEventListener("click", async () => {
  if (!viewer) return;
  try {
    const blob = await viewer.screenshot();
    if (!blob) throw Error();
    download(blob, `home402-${manifest.version}-${viewer.state.mode}.png`);
    notify("当前画面已导出。");
  } catch {
    notify("截图未能生成，请重试。", true);
  }
});
$("#performance-report").addEventListener("click", () => {
  if (!viewer) return;
  download(
    new Blob(
      [
        JSON.stringify(
          {
            version: manifest.version,
            capturedAt: new Date().toISOString(),
            browser: navigator.userAgent,
            viewport: [innerWidth, innerHeight],
            devicePixelRatio,
            view: viewer.snapshot(),
            performance: viewer.performance(),
            note: "当前浏览器会话的实际渲染采样；模拟视口不等于真实手机性能。",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    "home402-frame-times.json",
  );
});
document.addEventListener("click", async (event) => {
  const button = event.target.closest("button,a");
  if (!button) return;
  if (button.hasAttribute("data-close-dialog"))
    button.closest("dialog").close();
  if (button.hasAttribute("data-open-references")) openReference();
  if (button.dataset.reference) openReference(button.dataset.reference);
  if (button.dataset.mode) {
    const v = await loadModel();
    v?.setMode(button.dataset.mode);
  }
  if (button.hasAttribute("data-room")) {
    const v = await loadModel();
    v?.selectRoom(button.dataset.room || null);
  }
  if (button.dataset.detail) viewer?.detail(button.dataset.detail);
  if (button.hasAttribute("data-explore")) {
    event.preventDefault();
    $("#explore").scrollIntoView();
    loadModel();
  }
  if (button.dataset.roomJump || button.dataset.detailJump) {
    event.preventDefault();
    $("#explore").scrollIntoView();
    const v = await loadModel();
    if (v) {
      if (button.dataset.detailJump) v.detail(button.dataset.detailJump);
      else {
        v.selectRoom(button.dataset.roomJump, false);
        v.setMode("interior");
      }
      if (innerWidth < 700) $("#inspector-panel").open = false;
    }
  }
});
function planAction(event) {
  const room = event.target.closest("[data-room-id]"),
    entity = event.target.closest("[data-entity-id]");
  if (entity?.dataset.entityId) viewer?.selectEntity(entity.dataset.entityId);
  else if (room) viewer?.selectRoom(room.dataset.roomId);
}
$("#mini-plan").addEventListener("click", planAction);
$("#mini-plan").addEventListener("keydown", (event) => {
  if (["Enter", " "].includes(event.key)) {
    event.preventDefault();
    planAction(event);
  }
});
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const b = dialog.getBoundingClientRect();
      if (
        event.clientX < b.left ||
        event.clientX > b.right ||
        event.clientY < b.top ||
        event.clientY > b.bottom
      )
        dialog.close();
    }
  }),
);
document.addEventListener(
  "error",
  (event) => {
    const image = event.target;
    if (
      !(image instanceof HTMLImageElement) ||
      image.nextElementSibling?.classList.contains("image-retry")
    )
      return;
    const button = document.createElement("button");
    button.className = "image-retry";
    button.textContent = "图片未能载入，点击重试";
    button.addEventListener("click", () => {
      button.remove();
      const src = new URL(image.currentSrc || image.src, location.href);
      src.searchParams.set("retry", Date.now());
      image.srcset = "";
      image
        .closest("picture")
        ?.querySelectorAll("source")
        .forEach((s) => s.remove());
      image.src = src.href;
    });
    image.after(button);
  },
  true,
);
window.addEventListener("hashchange", () => {
  if (!data || !viewer) return;
  const state = decodeView(location.hash, data);
  if (state) {
    restoring = true;
    viewer.restore(state);
    restoring = false;
  }
});
window.addEventListener("pagehide", () => {
  clearTimeout(saveTimer);
  clearTimeout(messageTimer);
  loading?.abort();
  observer?.disconnect();
  if (viewer) {
    viewer.onChange = null;
    viewer.dispose();
    viewer = null;
  }
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    modelPlaceholder.hidden = false;
    loadPromise = null;
    configPromise = initialize();
  }
});
configPromise = initialize();

matchMedia("(max-width:700px)").addEventListener("change", (event) => {
  if (!event.matches) $("#inspector-panel").open = true;
});
