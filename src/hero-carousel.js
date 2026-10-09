import { homepageImages } from "./hero-images.js";

export function mountHeroCarousel(manifest, url) {
  const slides = homepageImages(manifest);
  if (!slides.length) return () => {};
  const root = document.querySelector("#home-gallery");
  const image = root.querySelector("#hero-image");
  const slide = root.querySelector("#hero-slide");
  const dots = root.querySelector("#hero-dots");
  const error = root.querySelector("#hero-error");
  const live = root.querySelector("#hero-live");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const events = new AbortController();
  let index = 0, requested = 0, sequence = 0, timer, failed, pointer;
  let hovering = false, focused = false;
  let visible = true, ready = false, busy = false, disposed = false;

  const listen = (target, type, handler) =>
    target.addEventListener(type, handler, { signal: events.signal });
  const number = (value) => String(value).padStart(2, "0");
  const stop = () => clearTimeout(timer);
  function schedule() {
    stop();
    if (ready && !disposed && !motion.matches && failed === undefined && !hovering && !focused &&
        !busy && visible && !document.hidden && slides.length > 1)
      timer = setTimeout(() => show(index + 1), 6000);
  }
  function caption(manual = false) {
    const current = slides[index];
    image.alt = `${current.title}（${current.label}）`;
    image.dataset.imageId = current.id;
    slide.setAttribute("aria-label", `${index + 1} / ${slides.length}：${current.title}`);
    root.querySelector("#hero-count").textContent = `${number(index + 1)} / ${number(slides.length)}`;
    root.querySelector("#hero-title").textContent = current.title;
    root.querySelector("#hero-kind").textContent = current.label;
    dots.querySelectorAll("button").forEach((button, i) =>
      button.setAttribute("aria-pressed", String(i === index)));
    if (manual) live.textContent = `${index + 1} / ${slides.length}，${current.title}，${current.label}`;
  }
  async function show(target, manual = false, retry = false) {
    requested = (target + slides.length) % slides.length;
    const next = requested, operation = ++sequence;
    stop();
    busy = true;
    error.hidden = true;
    root.setAttribute("aria-busy", "true");
    const candidate = new Image();
    candidate.decoding = "async";
    candidate.src = url(slides[next].path) + (retry ? `?retry=${Date.now()}` : "");
    try {
      await candidate.decode();
      if (operation !== sequence || disposed) return;
      image.src = candidate.src;
      if (image.nextElementSibling?.classList.contains("image-retry"))
        image.nextElementSibling.remove();
      index = next;
      failed = undefined;
      caption(manual);
      image.getAnimations().forEach((animation) => animation.cancel());
      if (!motion.matches)
        image.animate([{ opacity: 0.5 }, { opacity: 1 }], { duration: 380, easing: "ease-out" });
    } catch {
      if (operation !== sequence || disposed) return;
      failed = next;
      error.hidden = false;
      live.textContent = "这张图片暂时无法载入，当前图片已保留。可重试或选择其他图片。";
    } finally {
      if (operation === sequence && !disposed) {
        busy = false;
        root.setAttribute("aria-busy", "false");
        schedule();
      }
    }
  }
  dots.replaceChildren(...slides.map((current, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.heroSlide = current.id;
    button.setAttribute("aria-label", `第 ${i + 1} 张：${current.title}，${current.label}`);
    button.setAttribute("aria-controls", "hero-slide");
    listen(button, "click", () => show(i, true));
    return button;
  }));
  root.querySelectorAll("[data-carousel-controls]").forEach((element) =>
    element.hidden = slides.length < 2);
  caption();
  listen(root.querySelector("#hero-retry"), "click", () => show(failed ?? requested, true, true));
  listen(root, "keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    show(requested + (event.key === "ArrowLeft" ? -1 : 1), true);
  });
  listen(root, "pointerenter", (event) => {
    if (event.pointerType === "mouse") { hovering = true; schedule(); }
  });
  listen(root, "pointerleave", () => { hovering = false; schedule(); });
  listen(root, "focusin", () => { focused = true; schedule(); });
  listen(root, "focusout", (event) => {
    if (!root.contains(event.relatedTarget)) { focused = false; schedule(); }
  });
  listen(slide, "pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    pointer = event.isPrimary
      ? { id: event.pointerId, x: event.clientX, y: event.clientY }
      : undefined;
  });
  listen(slide, "pointerup", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    pointer = undefined;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5)
      show(requested + (dx < 0 ? 1 : -1), true);
  });
  listen(slide, "pointercancel", () => { pointer = undefined; });
  listen(motion, "change", () => {
    if (motion.matches) image.getAnimations().forEach((animation) => animation.cancel());
    schedule();
  });
  listen(document, "visibilitychange", schedule);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio >= 0.2;
    schedule();
  }, { threshold: 0.2 });
  observer.observe(root);
  image.decode().catch(() => {}).then(() => { ready = true; schedule(); });
  return () => {
    disposed = true;
    sequence++;
    stop();
    observer.disconnect();
    events.abort();
    image.getAnimations().forEach((animation) => animation.cancel());
  };
}
