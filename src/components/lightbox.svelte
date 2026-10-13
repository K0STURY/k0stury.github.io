<script lang="ts">
  import { onMount, tick } from "svelte";

  export let images: Array<{
    src: string;
    fullSrc: string;
    width: number;
    height: number;
    tags: string[];
    title: string;
    description: string;
    date: string;
  }> = [];

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
  $: hasDetails = !!(currentImage?.description || currentImage?.date || currentImage?.tags?.length);

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
    const origIdx = filteredMap[filteredIdx];
    if (origIdx == null || loadedFullRes.has(origIdx)) return;
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
    img.src = filteredImages[filteredIdx].fullSrc;
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

  function tileFor(origIdx: number) {
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
    const frameEl = tile?.querySelector<HTMLElement>(".sticker-frame");
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

  function lockPage(locked: boolean) {
    document.body.style.overflow = locked ? "hidden" : "";
    document.querySelector("nav")?.classList.toggle("lightbox-hidden", locked);
    document.getElementById("floating-top")?.classList.toggle("lightbox-hidden", locked);
  }

  async function open(index: number, filter?: string) {
    if (isOpen) return;

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
    returnFocus = document.activeElement as HTMLElement | null;

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
    isOpen = false;
    closing = false;
    ready = false;
    shown = false;
    navBusy = false;
    lockPage(false);
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
    if (e.button !== 0 || closing) return;
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

    if (event.key === "Escape") {
      close();
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
      open(detail.index, detail.filter);
    };
    document.addEventListener("lightbox:open", handleLightboxOpen);

    return () => {
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
    aria-label={currentImage?.title ? `Artwork: ${currentImage.title}` : "Artwork viewer"}
    tabindex="-1"
  >
    <div class="lb-dim" aria-hidden="true"></div>

    <button class="lb-close" on:click={close} aria-label="Close">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

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
            {#key currentOrig}
              <img
                src={isSharp ? currentImage?.fullSrc : currentImage?.src}
                alt={currentImage?.title || "Artwork"}
                class="print-img"
                class:is-thumb={!isSharp}
                decoding="async"
                draggable="false"
              />
            {/key}
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

  /* Close + counter sit in the top corners */
  .lb-close {
    position: absolute;
    top: 1.1rem;
    right: 1.25rem;
    z-index: 3;
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

  /* Thumbnail stand-in until the sharp version lands; scaled so the blur has no pale edge */
  .print-img.is-thumb {
    filter: blur(4px);
    transform: scale(1.03);
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

    .lb-close {
      top: 0.8rem;
      right: 0.8rem;
      width: 42px;
      height: 42px;
    }

    .lb-counter {
      top: 0.95rem;
      left: 0.9rem;
      font-size: 0.95rem;
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
    .lb-counter,
    .lb-arrow,
    .lb-strip,
    .hang-tag,
    .thumb,
    .tag-more,
    .tag-chevron,
    .print::before,
    .print-img {
      transition: none;
    }
  }
</style>
