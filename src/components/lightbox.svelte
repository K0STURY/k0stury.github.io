<script lang="ts">
  import { onMount, tick } from "svelte";

  export let images: Array<{
    id: number;
    src: string;
    fullSrc: string;
    width: number;
    height: number;
    tags: string[];
    title: string;
    description: string;
    date: string;
    redrawOf: number | null;
    // Set when the art is a panel inset on a plain canvas (fractions of the image)
    panel: { x: number; y: number; w: number; h: number } | null;
  }> = [];
  // Set on a piece's own page: open on this image as soon as the viewer mounts
  export let openAt: number | null = null;

  // Track which full-res images have loaded (by original image index)
  let loadedFullRes = new Set<number>();

  function onFullResLoad(index: number) {
    loadedFullRes.add(index);
    loadedFullRes = loadedFullRes; // trigger reactivity
  }

  // Viewer state
  let isOpen = false;
  let closing = false;
  let ready = false; // backdrop + controls faded in
  let shown = false; // print is allowed to paint (it stays hidden until its entrance starts)
  let activeIndex = 0;
  let tagOpen = false;

  let dialogEl: HTMLElement;
  let stageEl: HTMLElement;
  let moverEl: HTMLElement;
  let stripEl: HTMLElement;
  let returnFocus: HTMLElement | null = null;

  // Room the print has to fit in (the stage minus its padding)
  let stageW = 0;
  let stageH = 0;
  let narrow = false;

  // Filtered subset of images based on active gallery tag
  let filteredImages: typeof images = images;
  // Map from filtered index back to original index (for full-res tracking)
  let filteredMap: number[] = images.map((_, i) => i);

  // Keep filtered view synced when closed and source array changes
  $: if (!isOpen) {
    filteredImages = images;
    filteredMap = images.map((_, i) => i);
  }

  $: currentImage = filteredImages[activeIndex] || null;
  $: currentOrig = filteredMap[activeIndex] ?? -1;
  $: isSharp = loadedFullRes.has(currentOrig);
  $: hasDetails = !!(
    currentImage?.description ||
    currentImage?.date ||
    currentImage?.tags?.length ||
    partner
  );

  // Each print sits a touch crooked, alternating so flipping through doesn't feel stamped
  $: tilt = currentOrig % 2 === 0 ? -1.2 : 1.2;
  $: frame = narrow ? 6 : 10;
  $: art = fitArt(currentImage, stageW, stageH, frame);

  function fitArt(image: (typeof images)[number] | null, w: number, h: number, border: number) {
    if (!image || w <= 0 || h <= 0) return { w: 0, h: 0 };
    const scale = Math.min((w - border * 2) / image.width, (h - border * 2) / image.height);
    return { w: Math.max(1, Math.floor(image.width * scale)), h: Math.max(1, Math.floor(image.height * scale)) };
  }

  const OVERSHOOT = "cubic-bezier(0.34, 1.56, 0.64, 1)";
  const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Hold references to in-flight preload images so they aren't garbage-collected
  let preloadQueue = new Map<number, HTMLImageElement>();

  // Preload a full-res image; when it finishes mark it as loaded
  function preloadFullRes(filteredIdx: number) {
    preloadOrig(filteredMap[filteredIdx]);
  }

  function preloadOrig(origIdx: number | undefined) {
    if (origIdx == null || origIdx < 0 || loadedFullRes.has(origIdx)) return;
    if (preloadQueue.has(origIdx)) return; // already in flight

    const img = new Image();
    preloadQueue.set(origIdx, img);
    img.onload = () => {
      onFullResLoad(origIdx);
      preloadQueue.delete(origIdx);
    };
    img.onerror = () => {
      preloadQueue.delete(origIdx);
    };
    img.src = images[origIdx].fullSrc;

    // Already in the browser's cache (preloaded on hover, or seen before): it's ready
    // right now, so mark it sharp before the first frame instead of flashing the blurry stand-in
    if (img.complete && img.naturalWidth > 0) {
      img.onload = null;
      preloadQueue.delete(origIdx);
      onFullResLoad(origIdx);
    }
  }

  // The stand-in thumbnail is THUMB_WIDTH wide. Blur it only as much as it's being stretched:
  // shown near its own size it's nearly sharp already, so it barely needs hiding.
  const THUMB_WIDTH = 640;
  $: pixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  $: thumbStretch = (art.w * pixelRatio) / THUMB_WIDTH;
  $: thumbBlur = Math.min(4, Math.max(0, (thumbStretch - 1.15) * 2.5));

  // --- Redraws: then & now in one frame ---
  // The redraw lies over the original, cut away left of a slanted divider you drag.
  // Indices here are into the full `images` list.
  $: origById = new Map(images.map((img, i) => [img.id, i]));

  // For each original, the newest piece that redraws it (images run newest first)
  $: redrawnIn = images.reduce((found, img, i) => {
    const orig = img.redrawOf == null ? undefined : origById.get(img.redrawOf);
    if (orig != null && !found.has(orig)) found.set(orig, i);
    return found;
  }, new Map<number, number>());

  // What the current piece is compared with: its original if it is a redraw, otherwise its redraw
  $: partnerOrig =
    currentOrig < 0
      ? -1
      : images[currentOrig].redrawOf != null
        ? (origById.get(images[currentOrig].redrawOf!) ?? -1)
        : (redrawnIn.get(currentOrig) ?? -1);
  $: partner = partnerOrig >= 0 ? images[partnerOrig] : null;
  $: currentIsRedraw = partner != null && currentImage?.redrawOf === partner.id;
  $: thenOrig = currentIsRedraw ? partnerOrig : currentOrig;
  $: nowOrig = currentIsRedraw ? currentOrig : partnerOrig;

  let comparing = false;
  let split = 50; // where the divider is, 0 (all "now") to 100 (all "then"); left of it shows "then"
  let compareEl: HTMLElement;
  let splitPointer: number | null = null;

  // The divider is slanted, leaning right towards the bottom
  const DIVIDER_ANGLE = 0; // degrees from vertical; 0 makes it straight up and down
  const DIVIDER_TAN = Math.tan((DIVIDER_ANGLE * Math.PI) / 180);

  // How far the divider leans either side of where it crosses mid-height
  $: reach = (art.h / 2) * DIVIDER_TAN;
  // Where it crosses mid-height: from fully off the left edge (0) to fully off the right (100)
  $: dividerX = -reach + (split / 100) * (art.w + 2 * reach);

  // Sizes a piece so its art (its panel, if it has one) covers the frame,
  // so both prints line up even when one of them sits inset on a canvas
  // `zoom` eases between the whole image (0, as the print normally shows it) and its panel (1),
  // so a piece on a canvas zooms in and out with the divider instead of jumping
  function coverStyle(origIdx: number, frameW: number, frameH: number, zoom: number) {
    const img = images[origIdx];
    const panel = img.panel ?? { x: 0, y: 0, w: 1, h: 1 };
    const box = {
      x: panel.x * zoom,
      y: panel.y * zoom,
      w: 1 + (panel.w - 1) * zoom,
      h: 1 + (panel.h - 1) * zoom,
    };
    const boxW = box.w * img.width;
    const boxH = box.h * img.height;
    const scale = Math.max(frameW / boxW, frameH / boxH);
    const left = -box.x * img.width * scale - (boxW * scale - frameW) / 2;
    const top = -box.y * img.height * scale - (boxH * scale - frameH) / 2;
    return `width:${img.width * scale}px; height:${img.height * scale}px; left:${left}px; top:${top}px;`;
  }

  let leaving = false; // the divider is sliding away before the view closes
  let dragging = false;
  let knobEl: HTMLElement;
  let splitFrame = 0;

  // Where the divider rests while the view is closed: the edge that leaves the piece you're on
  // in full view, so opening and closing never jump to the other drawing
  $: restSplit = currentIsRedraw ? 0 : 100;

  // Overshoots and settles back, like something springy being let go
  const springOut = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
  const speedUp = (t: number) => t * t * t;

  let zoom = 0; // 0: pieces shown whole, 1: zoomed to their panels so the two line up
  const settle = (t: number) => 1 - Math.pow(1 - t, 3);

  // Moves the divider (with `ease`) and the zoom (with `zoomEase`, which never overshoots) together
  function animateCompare(
    toSplit: number,
    toZoom: number,
    duration: number,
    ease: (t: number) => number,
    zoomEase: (t: number) => number,
    done?: () => void,
  ) {
    cancelAnimationFrame(splitFrame);
    if (prefersReducedMotion()) {
      split = toSplit;
      zoom = toZoom;
      done?.();
      return;
    }
    const fromSplit = split;
    const fromZoom = zoom;
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      split = Math.min(100, Math.max(0, fromSplit + (toSplit - fromSplit) * ease(t)));
      zoom = fromZoom + (toZoom - fromZoom) * zoomEase(t);
      if (t < 1) splitFrame = requestAnimationFrame(frame);
      else done?.();
    };
    splitFrame = requestAnimationFrame(frame);
  }

  // Slides the divider back off the piece you're on and zooms back out, then ends the view.
  // It finishes on exactly what the print shows normally, so the swap back is invisible.
  function leaveCompare(duration: number) {
    if (!comparing || leaving) return;
    leaving = true;
    dragging = false;
    splitPointer = null;
    animateCompare(restSplit, 0, duration, speedUp, speedUp, () => {
      comparing = false;
      leaving = false;
    });
  }

  function toggleCompare() {
    if (comparing && !leaving) {
      leaveCompare(300);
      return;
    }
    if (!comparing) {
      split = restSplit;
      zoom = 0;
    }
    comparing = true;
    leaving = false;
    preloadOrig(partnerOrig);
    // Sweep in from that edge and spring into the middle, zooming in to line the two up
    animateCompare(50, 1, 700, springOut, settle);
  }

  function stopCompare() {
    cancelAnimationFrame(splitFrame);
    comparing = false;
    leaving = false;
    dragging = false;
    splitPointer = null;
    zoom = 0;
  }

  // Let go of the knob: it wobbles back to size
  function wobbleKnob() {
    if (!knobEl || prefersReducedMotion()) return;
    knobEl.animate([{ scale: "1.18" }, { scale: "0.9" }, { scale: "1.06" }, { scale: "1" }], {
      duration: 420,
      easing: "ease-out",
    });
  }

  // Puts the divider right through the pointer
  function moveSplit(e: PointerEvent) {
    const r = compareEl.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * art.w;
    const y = ((e.clientY - r.top) / r.height) * art.h;
    const atMid = x - (y - art.h / 2) * DIVIDER_TAN;
    split = Math.min(100, Math.max(0, ((atMid + reach) / (art.w + 2 * reach)) * 100));
  }

  // The divider follows the pointer; these stop at the compare layer so a drag never turns into a swipe
  function onComparePointerDown(e: PointerEvent) {
    e.stopPropagation();
    if (e.button !== 0 || leaving) return;
    cancelAnimationFrame(splitFrame);
    splitPointer = e.pointerId;
    dragging = true;
    compareEl.setPointerCapture(e.pointerId);
    moveSplit(e);
  }

  function onComparePointerMove(e: PointerEvent) {
    e.stopPropagation();
    if (e.pointerId === splitPointer) moveSplit(e);
  }

  function onComparePointerUp(e: PointerEvent) {
    e.stopPropagation();
    if (e.pointerId !== splitPointer) return;
    splitPointer = null;
    dragging = false;
    wobbleKnob();
  }

  // Preload adjacent full-res images so next/prev are ready
  $: if (isOpen && filteredImages.length > 0) {
    for (const offset of [-1, 0, 1, 2]) {
      const idx = (activeIndex + offset + filteredImages.length) % filteredImages.length;
      preloadFullRes(idx);
    }
  }

  // --- The gallery tile a piece came from ---
  // While a piece is up as a print, its tile is lifted off the board; it reappears on close.
  let awayTile: HTMLElement | null = null;

  // Opened from somewhere other than the gallery (a sticker in the hero): that element
  // stands in as the piece's tile, so the print grows out of it and flies back to it
  let source: { el: HTMLElement; orig: number } | null = null;

  function tileFor(origIdx: number) {
    if (source && source.orig === origIdx && source.el.isConnected) return source.el;
    return document.querySelector<HTMLElement>(
      `.gallery-item[data-lightbox-index="${origIdx}"]:not(.hidden)`,
    );
  }

  function setAwayTile(tile: HTMLElement | null) {
    if (awayTile && awayTile !== tile) awayTile.style.visibility = "";
    awayTile = tile;
    if (tile) tile.style.visibility = "hidden";
  }

  $: if (isOpen && !closing) setAwayTile(tileFor(currentOrig));

  // Where a tile's frame is on screen right now, including its tilt and any hover scale
  function tileGeometry(tile: HTMLElement | null) {
    // A gallery tile's frame sits inside it; a hero sticker is its own frame
    const frameEl = tile?.querySelector<HTMLElement>(".sticker-frame") ?? tile;
    if (!frameEl) return null;
    const r = frameEl.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return null; // scrolled out of view

    const m = new DOMMatrix(getComputedStyle(frameEl).transform);
    return {
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      size: frameEl.offsetWidth * Math.hypot(m.a, m.b),
      rot: (Math.atan2(m.b, m.a) * 180) / Math.PI,
    };
  }

  // The transform that puts the print exactly on top of that tile
  function ontoTile(geo: NonNullable<ReturnType<typeof tileGeometry>>) {
    const m = moverEl.getBoundingClientRect();
    const dx = geo.cx - (m.left + m.width / 2);
    const dy = geo.cy - (m.top + m.height / 2);
    const scale = geo.size / Math.min(m.width, m.height); // tiles crop to a square
    return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${(geo.rot - tilt).toFixed(2)}deg) scale(${scale.toFixed(4)})`;
  }

  function measureStage() {
    if (!stageEl) return;
    const cs = getComputedStyle(stageEl);
    stageW = stageEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    stageH = stageEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    narrow = window.innerWidth <= 768;
  }

  function watchStage(node: HTMLElement) {
    const observer = new ResizeObserver(measureStage);
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }

  function centerThumb(smooth: boolean) {
    const thumb = stripEl?.children[activeIndex] as HTMLElement | undefined;
    if (!thumb) return;
    stripEl.scrollTo({
      left: thumb.offsetLeft - (stripEl.clientWidth - thumb.offsetWidth) / 2,
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
    });
  }

  // --- Shareable links ---
  // While a piece is up, the address bar shows its own page (/art/<id>), so copying
  // the URL or reloading lands on that piece. Closing puts back the URL from before.
  // replaceState, not pushState: Astro's router owns back/forward, and keeps its own
  // data in history.state, so that is carried over untouched.
  let urlBeforeOpen = "";

  const pieceUrl = (id: number) => new URL(`/art/${id}`, location.origin).href;

  function setUrl(url: string) {
    if (url && url !== location.href) history.replaceState(history.state, "", url);
  }

  $: if (isOpen && !closing && currentImage) setUrl(pieceUrl(currentImage.id));

  let copied = false;
  let copiedTimer: ReturnType<typeof setTimeout>;

  async function sharePiece() {
    if (!currentImage) return;
    const url = pieceUrl(currentImage.id);

    // Phones get the system share sheet; on desktop that sheet is clunky, so just copy
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: currentImage.title || "Art by Kostur", url });
      } catch {
        // Share sheet dismissed
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return;
    }
    copied = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = false), 1600);
  }

  function lockPage(locked: boolean) {
    document.body.style.overflow = locked ? "hidden" : "";
    if (locked) window.lenis?.stop();
    else window.lenis?.start();
    document.querySelector("nav")?.classList.toggle("lightbox-hidden", locked);
    document.getElementById("floating-top")?.classList.toggle("lightbox-hidden", locked);
  }

  async function open(index: number, filter?: string, sourceEl?: HTMLElement) {
    if (isOpen) return;
    source = sourceEl ? { el: sourceEl, orig: index } : null;

    // Build filtered subset based on current gallery tag
    if (filter && filter !== "all") {
      filteredMap = [];
      filteredImages = images.filter((img, i) => {
        if (img.tags.includes(filter)) {
          filteredMap.push(i);
          return true;
        }
        return false;
      });
    } else {
      filteredImages = images;
      filteredMap = images.map((_, i) => i);
    }

    // Find where the clicked image lands in the filtered list
    const filteredIndex = filteredMap.indexOf(index);
    activeIndex = filteredIndex >= 0 ? filteredIndex : 0;

    tagOpen = false;
    closing = false;
    ready = false;
    shown = false;
    copied = false;
    stopCompare();
    returnFocus = document.activeElement as HTMLElement | null;
    // Arriving on a piece's own page, closing should leave you on the home page
    urlBeforeOpen = location.pathname.startsWith("/art/") ? location.origin + "/" : location.href;

    // Check for the sharp version before the viewer first draws, so a cached one shows sharp straight away
    preloadOrig(filteredMap[activeIndex]);

    isOpen = true;
    lockPage(true);

    // Mount, then size the print, so its resting place is known before it flies there
    await tick();
    measureStage();
    await tick();
    centerThumb(false);
    dialogEl?.focus({ preventScroll: true });

    const geo = tileGeometry(tileFor(currentOrig));
    shown = true;
    ready = true;
    if (prefersReducedMotion()) return;

    if (geo) {
      // Grow from the tile's spot on the board
      moverEl.animate([{ transform: ontoTile(geo) }, { transform: "none" }], {
        duration: 480,
        easing: "cubic-bezier(0.3, 1.3, 0.5, 1)",
      });
    } else {
      moverEl.animate(
        [
          { opacity: 0, transform: "translateY(-40px) scale(0.9) rotate(-6deg)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 380, easing: OVERSHOOT },
      );
    }
  }

  async function close() {
    if (!isOpen || closing) return;
    closing = true;
    drag = null;
    navToken++;
    // Mid-comparison: lay the divider back off this piece while the print flies home,
    // so it lands on its tile as just this piece
    leaveCompare(260);

    if (moverEl) {
      moverEl.getAnimations().forEach((a) => a.cancel());
      moverEl.style.transform = "";

      if (!prefersReducedMotion()) {
        // Settle back onto its tile if that tile is on screen, otherwise just drop away
        const geo = tileGeometry(tileFor(currentOrig));
        const leave = geo
          ? moverEl.animate([{ transform: "none" }, { transform: ontoTile(geo) }], {
              duration: 380,
              easing: "cubic-bezier(0.5, 0, 0.2, 1)",
              fill: "forwards",
            })
          : moverEl.animate(
              [
                { opacity: 1, transform: "none" },
                { opacity: 0, transform: "translateY(36px) scale(0.9) rotate(5deg)" },
              ],
              { duration: 240, easing: "ease-in", fill: "forwards" },
            );
        try {
          await leave.finished;
        } catch {
          // Cancelled: fall through and close anyway
        }
      }
    }

    setAwayTile(null);
    source = null;
    isOpen = false;
    stopCompare();
    closing = false;
    ready = false;
    shown = false;
    navBusy = false;
    lockPage(false);
    setUrl(urlBeforeOpen);
    returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
  }

  // --- Moving between pieces ---
  let navToken = 0; // bumped on every move, so an older move knows it was overtaken
  let navBusy = false;

  function step(dir: number, fromX = 0) {
    const n = filteredImages.length;
    goTo((activeIndex + dir + n) % n, dir, fromX);
  }

  // The current print slides off one side and the next one is dealt in from the other.
  // `fromX` is where a swipe let go, so the exit carries on from under the finger.
  async function goTo(idx: number, dir: number, fromX = 0) {
    if (closing || filteredImages.length < 2 || idx === activeIndex) return;

    const token = ++navToken;
    const reduce = prefersReducedMotion();
    // Already mid-move (held arrow key, fast clicks): skip the exit so it never lags behind
    const skipExit = navBusy || reduce;
    navBusy = true;

    const far = Math.max(stageW * 0.6, 320);
    moverEl.getAnimations().forEach((a) => a.cancel());

    if (!skipExit) {
      try {
        await moverEl.animate(
          [
            { transform: `translateX(${fromX}px) rotate(${fromX * 0.03}deg)`, opacity: 1 },
            { transform: `translateX(${-dir * far}px) rotate(${-dir * 14}deg)`, opacity: 0 },
          ],
          { duration: 170, easing: "cubic-bezier(0.5, 0, 0.9, 0.4)", fill: "forwards" },
        ).finished;
      } catch {
        // Cancelled by a newer move
      }
      if (token !== navToken) return;
    }

    activeIndex = idx;
    stopCompare();
    await tick();
    centerThumb(true);
    if (token !== navToken) return;

    moverEl.getAnimations().forEach((a) => a.cancel());
    if (!reduce) {
      try {
        await moverEl.animate(
          [
            { transform: `translateX(${dir * far * 0.7}px) rotate(${dir * 10}deg)`, opacity: 0 },
            { transform: "none", opacity: 1 },
          ],
          { duration: 340, easing: OVERSHOOT },
        ).finished;
      } catch {
        // Cancelled by a newer move
      }
    }
    if (token === navToken) navBusy = false;
  }

  // --- Swipe / drag the print sideways ---
  let drag: { id: number; x: number; y: number; dx: number; active: boolean } | null = null;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || closing || comparing) return;
    if ((e.target as HTMLElement).closest(".hang-tag")) return; // the tag is a control, not a handle
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, active: false };
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;

    if (!drag.active) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      drag.active = true;
      moverEl.setPointerCapture(e.pointerId);
      moverEl.getAnimations().forEach((a) => a.cancel());
    }

    drag.dx = dx;
    moverEl.style.transform = `translateX(${dx}px) rotate(${dx * 0.03}deg)`;
  }

  function onPointerUp(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const { dx, active } = drag;
    drag = null;
    if (!active) return;

    moverEl.style.transform = "";
    const threshold = Math.min(110, stageW * 0.22);
    if (Math.abs(dx) > threshold && filteredImages.length > 1) {
      step(dx < 0 ? 1 : -1, dx);
    } else {
      // Not far enough: spring back
      moverEl.animate(
        [{ transform: `translateX(${dx}px) rotate(${dx * 0.03}deg)` }, { transform: "none" }],
        { duration: 300, easing: OVERSHOOT },
      );
    }
  }

  function onStripWheel(e: WheelEvent) {
    stripEl.scrollLeft += e.deltaY + e.deltaX;
  }

  function onStageClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;

    // Arrow keys on the then/now divider move the divider, not the piece
    const onDivider = (event.target as HTMLElement | null)?.classList?.contains("compare-range");

    if (event.key === "Escape") {
      close();
    } else if (onDivider && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      return;
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "Tab" && dialogEl) {
      // Keep focus inside the viewer while it is open
      const focusable = [...dialogEl.querySelectorAll<HTMLElement>('button:not([tabindex="-1"])')].filter(
        (el) => el.offsetParent !== null,
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || current === dialogEl)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeydown);

    const handleLightboxOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // The gallery sends its tile's index; elsewhere (the hero) sends the piece's id
      const index = detail.id != null ? origById.get(detail.id) : detail.index;
      if (index == null) return;
      open(index, detail.filter, detail.source);
    };
    document.addEventListener("lightbox:open", handleLightboxOpen);

    if (openAt != null) open(openAt);

    return () => {
      clearTimeout(copiedTimer);
      cancelAnimationFrame(splitFrame);
      window.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("lightbox:open", handleLightboxOpen);

      if (isOpen) {
        setAwayTile(null);
        lockPage(false);
      }
    };
  });
</script>

{#if isOpen}
  <div
    bind:this={dialogEl}
    class="lb"
    class:is-ready={ready}
    class:is-closing={closing}
    role="dialog"
    aria-modal="true"
    data-lenis-prevent
    aria-label={currentImage?.title ? `Artwork: ${currentImage.title}` : "Artwork viewer"}
    tabindex="-1"
  >
    <div class="lb-dim" aria-hidden="true"></div>

    <div class="lb-actions">
      {#if partner}
        <button
          class="lb-label lb-compare"
          class:is-on={comparing && !leaving}
          aria-pressed={comparing && !leaving}
          on:click={toggleCompare}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="3" x2="12" y2="21"></line>
            <polyline points="7 8 3 12 7 16"></polyline>
            <polyline points="17 8 21 12 17 16"></polyline>
          </svg>
          <span class="lb-label-text">Then &amp; now</span>
        </button>
      {/if}

      <button class="lb-label lb-share" class:is-on={copied} on:click={sharePiece}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          {#if copied}
            <polyline points="5 12.5 10 17.5 19 7"></polyline>
          {:else}
            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"></path>
            <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"></path>
          {/if}
        </svg>
        <span class="lb-label-text" aria-live="polite">{copied ? "Link copied" : "Share"}</span>
      </button>

      <button class="lb-close" on:click={close} aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <p class="lb-counter" aria-live="polite">
      {activeIndex + 1}<span class="lb-counter-total">/ {filteredImages.length}</span>
    </p>

    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="lb-stage" bind:this={stageEl} use:watchStage on:click={onStageClick}>
      {#if filteredImages.length > 1}
        <button class="lb-arrow lb-arrow--prev" on:click={() => step(-1)} aria-label="Previous piece">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 5 8 12 15 19"></polyline>
          </svg>
        </button>
      {/if}

      <!-- Outer layer is moved by script (grow, swipe, deal); the print inside keeps its own tilt -->
      <div
        class="lb-mover"
        class:is-shown={shown}
        bind:this={moverEl}
        on:pointerdown={onPointerDown}
        on:pointermove={onPointerMove}
        on:pointerup={onPointerUp}
        on:pointercancel={onPointerUp}
      >
        <div class="print" style="--tilt:{tilt}deg; --frame:{frame}px;">
          <div class="print-art" style="width:{art.w}px; height:{art.h}px;">
            {#if comparing && partner}
              <div
                class="compare"
                class:is-leaving={leaving}
                class:is-dragging={dragging}
                bind:this={compareEl}
                on:pointerdown={onComparePointerDown}
                on:pointermove={onComparePointerMove}
                on:pointerup={onComparePointerUp}
                on:pointercancel={onComparePointerUp}
              >
                <!-- Underneath: the original -->
                <div class="sheet">
                  <img
                    src={loadedFullRes.has(thenOrig) ? images[thenOrig].fullSrc : images[thenOrig].src}
                    alt={`Then: ${images[thenOrig].title || "the original"}`}
                    class="sheet-img"
                    style={coverStyle(thenOrig, art.w, art.h, zoom)}
                    draggable="false"
                  />
                  <span class="compare-tab compare-tab--then" aria-hidden="true">then</span>
                </div>

                <!-- On top: the redraw, cut away left of the divider -->
                <div
                  class="sheet"
                  style="clip-path: polygon({dividerX - reach}px 0, 100% 0, 100% 100%, {dividerX + reach}px 100%);"
                >
                  <img
                    src={loadedFullRes.has(nowOrig) ? images[nowOrig].fullSrc : images[nowOrig].src}
                    alt={`Now: ${images[nowOrig].title || "the redraw"}`}
                    class="sheet-img"
                    style={coverStyle(nowOrig, art.w, art.h, zoom)}
                    draggable="false"
                  />
                  <span class="compare-tab compare-tab--now" aria-hidden="true">now</span>
                </div>

                <!-- The divider: a line along the cut, long enough to cross the frame at its slant -->
                <span
                  class="compare-line"
                  style="left:{dividerX}px; height:{2 * (art.w + art.h)}px; transform:translate(-50%, -50%) rotate({-DIVIDER_ANGLE}deg);"
                  aria-hidden="true"
                ></span>

                <input
                  class="compare-range"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  bind:value={split}
                  aria-label="How much of the original to show"
                />
                <span class="compare-knob" style="left:{dividerX}px;" bind:this={knobEl} aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 6 3 12 9 18"></polyline>
                    <polyline points="15 6 21 12 15 18"></polyline>
                  </svg>
                </span>
              </div>
            {:else}
              {#key currentOrig}
                <img
                  src={isSharp ? currentImage?.fullSrc : currentImage?.src}
                  alt={currentImage?.title || "Artwork"}
                  class="print-img"
                  class:is-thumb={!isSharp}
                  style="--thumb-blur:{thumbBlur.toFixed(2)}px; --thumb-zoom:{(1 + thumbBlur * 0.0075).toFixed(4)};"
                  decoding="async"
                  draggable="false"
                />
              {/key}
            {/if}
          </div>

          <div class="hang-tag" class:is-open={tagOpen}>
            {#if hasDetails}
              <button
                class="tag-head"
                on:click={() => (tagOpen = !tagOpen)}
                aria-expanded={tagOpen}
                aria-controls="lb-tag-more"
              >
                <span class="tag-hole" aria-hidden="true"></span>
                <span class="tag-title">{currentImage?.title || "Untitled"}</span>
                <svg class="tag-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="6 15 12 9 18 15"></polyline>
                </svg>
              </button>

              <div class="tag-more" id="lb-tag-more">
                <div class="tag-more-inner">
                  {#if currentImage?.description}
                    <p class="tag-description">{currentImage.description}</p>
                  {/if}
                  {#if currentImage?.date}
                    <p class="tag-date">{currentImage.date}</p>
                  {/if}
                  {#if partner}
                    <p class="tag-redraw">
                      {currentIsRedraw
                        ? `A redraw of ${partner.title || "an older piece"}`
                        : `Redrawn later as ${partner.title || "a newer piece"}`}
                    </p>
                  {/if}
                  {#if currentImage?.tags?.length}
                    <ul class="tag-cats">
                      {#each currentImage.tags as tag}
                        <li>{tag}</li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              </div>
            {:else}
              <p class="tag-head">
                <span class="tag-hole" aria-hidden="true"></span>
                <span class="tag-title">{currentImage?.title || "Untitled"}</span>
              </p>
            {/if}
          </div>
        </div>
      </div>

      {#if filteredImages.length > 1}
        <button class="lb-arrow lb-arrow--next" on:click={() => step(1)} aria-label="Next piece">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 5 16 12 9 19"></polyline>
          </svg>
        </button>
      {/if}
    </div>

    {#if filteredImages.length > 1}
      <div class="lb-strip" bind:this={stripEl} on:wheel|preventDefault={onStripWheel}>
        {#each filteredImages as image, i}
          <button
            class="thumb"
            class:is-active={i === activeIndex}
            on:click={() => goTo(i, i > activeIndex ? 1 : -1)}
            aria-label={image.title || "Untitled artwork"}
            aria-current={i === activeIndex ? "true" : undefined}
            tabindex={i === activeIndex ? 0 : -1}
          >
            <!-- loading must come before src: attributes are applied in order, and a src
                 set first starts downloading before the browser knows it is lazy -->
            <img loading="lazy" decoding="async" src={image.src} alt="" draggable="false" />
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .lb {
    --paper: var(--text-color);
    --ink: var(--primary-color);
    --chrome: 0; /* opacity of everything that isn't the print itself */

    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    outline: none;
  }

  .lb.is-ready {
    --chrome: 1;
  }

  .lb.is-closing {
    --chrome: 0;
  }

  /* The desk, dimmed: same surface and dot grid, with the gallery faintly showing through */
  .lb-dim {
    position: absolute;
    inset: 0;
    background-color: color-mix(in srgb, var(--primary-color) 93%, transparent);
    background-image: radial-gradient(rgba(244, 240, 232, 0.05) 1px, transparent 1px);
    background-size: 22px 22px;
    opacity: var(--chrome);
    transition: opacity 0.3s ease;
  }

  /* Counter sits top left; the piece's actions and close sit top right */
  .lb-actions {
    position: absolute;
    top: 1.1rem;
    right: 1.25rem;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }

  .lb-close {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border: none;
    border-radius: 50%;
    background: var(--paper);
    color: var(--ink);
    box-shadow: 4px 4px 0 var(--edge-color);
    cursor: pointer;
    opacity: var(--chrome);
    transform: rotate(6deg);
    transition:
      opacity 0.25s ease,
      transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
      background-color 0.2s ease;
  }

  .lb-close:hover {
    background: var(--accent-color);
    transform: rotate(90deg) scale(1.08);
  }

  /* Then & now, Share: paper labels stuck next to the close button */
  .lb-label {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.4rem 0.85rem 0.3rem;
    border: none;
    border-radius: 4px;
    background: var(--paper);
    color: var(--ink);
    box-shadow: 3px 3px 0 var(--edge-color);
    font-family: var(--font-accent);
    font-size: 1rem;
    letter-spacing: 0.02em;
    cursor: pointer;
    opacity: var(--chrome);
    transform: rotate(-2deg);
    transition:
      opacity 0.25s ease,
      transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
      background-color 0.2s ease;
  }

  .lb-compare {
    transform: rotate(2deg);
  }

  .lb-label svg {
    flex-shrink: 0;
    margin-top: -0.1rem;
  }

  .lb-label:hover {
    background: var(--accent-color);
    transform: rotate(0deg) scale(1.05);
  }

  .lb-label.is-on {
    background: var(--accent-color);
    animation: gelatine 0.375s ease-in-out;
  }

  /* Then & now: the redraw over the original, cut away left of a slanted divider */
  .compare {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    cursor: ew-resize;
    touch-action: none;
  }

  .sheet {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  /* Sized and placed by script, so a piece's art (not its canvas) fills the frame */
  .sheet-img {
    position: absolute;
    display: block;
    max-width: none;
    pointer-events: none;
  }

  .compare-line {
    position: absolute;
    top: 50%;
    width: 4px;
    background: var(--paper);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ink) 25%, transparent);
    pointer-events: none;
    transition: background-color 0.2s ease, width 0.2s ease;
  }

  .compare.is-dragging .compare-line {
    width: 6px;
    background: var(--accent-color);
  }

  /* A grab point on the divider, where it crosses mid-height */
  .compare-knob {
    position: absolute;
    top: 50%;
    z-index: 2;
    pointer-events: none;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--paper);
    color: var(--ink);
    box-shadow: 3px 3px 0 var(--edge-color);
    transform: translate(-50%, -50%);
    /* Pops in with a spin as the divider arrives */
    animation: knob-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.18s backwards;
    transition:
      scale 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
      rotate 0.25s ease,
      opacity 0.25s ease,
      background-color 0.2s ease;
  }

  /* The arrows nudge apart a couple of times: you can drag this */
  .compare-knob svg {
    animation: knob-nudge 0.8s ease-in-out 0.75s 2;
  }

  .compare.is-dragging .compare-knob {
    scale: 1.18;
    background: var(--accent-color);
  }

  .compare.is-leaving .compare-knob {
    scale: 0;
    rotate: 90deg;
    opacity: 0;
  }

  @keyframes knob-in {
    from {
      scale: 0;
      rotate: -120deg;
    }
    to {
      scale: 1;
      rotate: 0deg;
    }
  }

  @keyframes knob-nudge {
    0%, 100% { scale: 1 1; }
    35% { scale: 1.3 0.9; }
    60% { scale: 0.95 1.05; }
  }

  /* The real control is this range input, kept invisible: it gives keyboards and screen readers the divider */
  .compare-range {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    pointer-events: none;
  }

  .compare-range:focus-visible + .compare-knob {
    outline: 3px solid var(--accent-color);
    outline-offset: 3px;
  }

  .compare-tab {
    position: absolute;
    bottom: 0.6rem;
    padding: 0.2rem 0.6rem 0.1rem;
    border-radius: 3px;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-accent);
    font-size: 0.85rem;
    letter-spacing: 0.03em;
    box-shadow: 2px 2px 0 var(--edge-color);
    pointer-events: none;
    /* Stuck on like stickers, one after the other */
    animation: tab-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
    transition:
      translate 0.25s ease-in,
      opacity 0.2s ease-in;
  }

  .compare-tab--then {
    left: 0.6rem;
    rotate: -3deg;
    animation-delay: 0.3s;
  }

  .compare-tab--now {
    right: 0.6rem;
    rotate: 3deg;
    animation-delay: 0.4s;
  }

  .compare.is-leaving .compare-tab {
    translate: 0 14px;
    opacity: 0;
  }

  @keyframes tab-in {
    from {
      opacity: 0;
      translate: 0 -14px;
      scale: 1.4;
    }
    to {
      opacity: 1;
      translate: 0 0;
      scale: 1;
    }
  }

  .lb-counter {
    position: absolute;
    top: 1.25rem;
    left: 1.5rem;
    z-index: 3;
    padding: 0.3rem 0.8rem 0.2rem;
    border-radius: 4px;
    background: var(--paper);
    color: var(--ink);
    box-shadow: 3px 3px 0 var(--edge-color);
    font-family: var(--font-accent);
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
    opacity: var(--chrome);
    transform: rotate(-3deg);
    transition: opacity 0.25s ease;
  }

  .lb-counter-total {
    margin-left: 0.35em;
    opacity: 0.55;
  }

  /* Stage: its padding is the breathing room around the print (arrows, tape, tag overhang) */
  .lb-stage {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2.4rem 7rem 2.6rem;
  }

  .lb-mover {
    position: relative;
    z-index: 1;
    cursor: grab;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
  }

  .lb-mover:active {
    cursor: grabbing;
  }

  .lb-mover:not(.is-shown) {
    visibility: hidden;
  }

  /* The print: a paper-framed piece, taped up a little crooked */
  .print {
    position: relative;
    border: var(--frame) solid var(--paper);
    border-radius: 6px;
    background: var(--paper);
    box-shadow: 10px 10px 0 var(--edge-color);
    transform: rotate(var(--tilt));
  }

  .print::before {
    content: "";
    position: absolute;
    top: calc(-13px - var(--frame));
    left: 50%;
    z-index: 2;
    width: 96px;
    height: 26px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--accent-color) 75%, transparent);
    opacity: var(--chrome);
    transform: translateX(-50%) rotate(-3deg);
    transition: opacity 0.25s ease;
  }

  .print-art {
    overflow: hidden;
    border-radius: 2px;
    background: color-mix(in srgb, var(--ink) 10%, var(--paper));
  }

  .print-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    transition: filter 0.35s ease;
  }

  /* Thumbnail stand-in until the sharp version lands. Blurred only as much as it's stretched
     (set by script), and scaled up just enough that the blur has no pale edge. */
  .print-img.is-thumb {
    filter: blur(var(--thumb-blur, 4px));
    transform: scale(var(--thumb-zoom, 1.03));
  }

  /* Tag hanging off the bottom corner: title always, the rest unfolds upward.
     Folded, it sits on the paper border and below it, so it stays off the art. */
  .hang-tag {
    position: absolute;
    right: -2.4rem;
    bottom: calc(-1.5rem - var(--frame));
    z-index: 3;
    min-width: 8rem;
    max-width: min(17rem, 72vw);
    border-radius: 16px 5px 5px 16px;
    background: var(--accent-color);
    color: var(--ink);
    box-shadow: 4px 4px 0 var(--edge-color);
    cursor: default;
    opacity: var(--chrome);
    transform: rotate(3deg);
    transition:
      opacity 0.25s ease,
      transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .hang-tag.is-open {
    transform: rotate(0deg);
  }

  .tag-head {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.6rem 0.9rem 0.45rem 0.75rem;
    border: none;
    background: transparent;
    color: inherit;
    font-family: var(--font-accent);
    font-size: 1.05rem;
    line-height: 1.15;
    letter-spacing: 0.02em;
    text-align: left;
  }

  button.tag-head {
    cursor: pointer;
  }

  .tag-hole {
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    margin-bottom: 0.15rem;
    border-radius: 50%;
    background: var(--ink);
  }

  .tag-title {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .tag-chevron {
    flex-shrink: 0;
    margin-bottom: 0.15rem;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .tag-more {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.3s ease;
  }

  .tag-more-inner {
    min-height: 0;
    overflow: hidden;
    visibility: hidden;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding: 0 0.9rem 0 calc(0.75rem + 10px + 0.55rem);
    transition: visibility 0.3s;
  }

  .hang-tag.is-open .tag-more {
    grid-template-rows: 1fr;
  }

  .hang-tag.is-open .tag-more-inner {
    visibility: visible;
  }

  .hang-tag.is-open .tag-chevron {
    transform: rotate(180deg);
  }

  @media (hover: hover) {
    .hang-tag:hover {
      transform: rotate(0deg);
    }

    .hang-tag:hover .tag-more {
      grid-template-rows: 1fr;
    }

    .hang-tag:hover .tag-more-inner {
      visibility: visible;
    }

    .hang-tag:hover .tag-chevron {
      transform: rotate(180deg);
    }
  }

  .tag-description {
    font-size: 0.85rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .tag-date {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-variant-numeric: tabular-nums;
  }

  .tag-redraw {
    font-size: 0.8rem;
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .tag-cats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    list-style: none;
    padding-bottom: 0.75rem;
  }

  .tag-cats li {
    padding: 0.12rem 0.6rem;
    border: 1.5px solid var(--ink);
    border-radius: 9999px;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* Arrows: chunky paper buttons either side of the print */
  .lb-arrow {
    position: absolute;
    top: 50%;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    border: none;
    border-radius: 50%;
    background: var(--paper);
    color: var(--ink);
    box-shadow: 4px 4px 0 var(--edge-color);
    cursor: pointer;
    opacity: var(--chrome);
    transform: translateY(-50%) rotate(var(--lean));
    transition:
      opacity 0.25s ease,
      transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
      background-color 0.2s ease;
  }

  .lb-arrow--prev {
    --lean: -5deg;
    left: 1.5rem;
  }

  .lb-arrow--next {
    --lean: 5deg;
    right: 1.5rem;
  }

  .lb-arrow:hover {
    background: var(--accent-color);
    transform: translateY(-50%) rotate(0deg) scale(1.12);
  }

  .lb-arrow:active {
    transform: translateY(-50%) rotate(0deg) scale(0.94);
  }

  /* Thumbnail strip: the current piece is always the one in the middle */
  .lb-strip {
    --thumb: 64px;

    position: relative;
    z-index: 2;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 1.1rem calc(50% - var(--thumb) / 2) 1.25rem;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    opacity: var(--chrome);
    mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent);
    -webkit-mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent);
    transition: opacity 0.25s ease;
  }

  .lb-strip::-webkit-scrollbar {
    display: none;
  }

  .thumb {
    flex: 0 0 var(--thumb);
    width: var(--thumb);
    height: var(--thumb);
    padding: 0;
    border: 3px solid var(--paper);
    border-radius: 10px;
    background: var(--paper);
    box-shadow: 3px 3px 0 var(--edge-color);
    overflow: hidden;
    cursor: pointer;
    opacity: 0.5;
    transform: rotate(-3deg);
    transition:
      opacity 0.2s ease,
      transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
      border-color 0.2s ease;
  }

  .thumb:nth-child(even) {
    transform: rotate(2.5deg);
  }

  .thumb:nth-child(3n) {
    transform: rotate(-1.5deg);
  }

  .thumb:hover {
    opacity: 1;
    transform: translateY(-4px) rotate(0deg);
  }

  .thumb.is-active {
    border-color: var(--accent-color);
    background: var(--accent-color);
    opacity: 1;
    transform: translateY(-7px) scale(1.14) rotate(0deg);
  }

  .thumb img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 6px;
    object-fit: cover;
    pointer-events: none;
  }

  .lb :focus-visible {
    outline: 3px solid var(--accent-color);
    outline-offset: 3px;
  }

  /* Phones: swipe and the strip do the navigating, the art gets the width */
  @media (max-width: 768px) {
    .lb-stage {
      padding: 4.2rem 0.9rem 2.6rem;
    }

    .lb-arrow {
      display: none;
    }

    .lb-actions {
      top: 0.8rem;
      right: 0.8rem;
      gap: 0.6rem;
    }

    .lb-close {
      width: 42px;
      height: 42px;
    }

    .lb-counter {
      top: 0.95rem;
      left: 0.9rem;
      font-size: 0.95rem;
    }

    .lb-label {
      font-size: 0.95rem;
    }

    .compare-knob {
      width: 34px;
      height: 34px;
    }

    .print {
      box-shadow: 6px 6px 0 var(--edge-color);
    }

    .print::before {
      width: 72px;
      height: 20px;
      top: calc(-10px - var(--frame));
    }

    .hang-tag {
      right: -0.4rem;
      max-width: min(15rem, 66vw);
    }

    .tag-head {
      font-size: 0.95rem;
    }

    .lb-strip {
      --thumb: 50px;

      gap: 0.55rem;
      padding-top: 1rem;
      padding-bottom: calc(0.9rem + env(safe-area-inset-bottom));
    }
  }

  /* Narrow phones: the labels shrink to their icons (the text stays for screen readers) */
  @media (max-width: 420px) {
    .lb-label {
      padding: 0.55rem 0.6rem;
    }

    .lb-label-text {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }

  /* Short screens (phones on their side): give the art the height */
  @media (max-height: 520px) {
    .lb-stage {
      padding-top: 1.6rem;
      padding-bottom: 2.2rem;
    }

    .lb-strip {
      --thumb: 40px;

      padding-top: 0.7rem;
      padding-bottom: 0.6rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .lb-dim,
    .lb-close,
    .lb-label,
    .lb-counter,
    .lb-arrow,
    .lb-strip,
    .hang-tag,
    .thumb,
    .tag-more,
    .tag-chevron,
    .print::before,
    .print-img,
    .compare-line {
      transition: none;
    }

    .compare-knob,
    .compare-knob svg,
    .compare-tab {
      animation: none;
      transition: none;
    }
  }
</style>
