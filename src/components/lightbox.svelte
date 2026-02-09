<script lang="ts">
  import { onMount, tick } from "svelte";
  import { fade, fly } from "svelte/transition";
  import Swiper from "swiper";
  import { Navigation, Keyboard } from "swiper/modules";
  import "swiper/css";
  import "swiper/css/navigation";

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

  // Lightbox state
  let isOpen = false;
  let initialSlide = 0;
  let activeIndex = 0;
  let swiperInstance: Swiper | null = null;
  let swiperContainer: HTMLElement;
  let mobileInfoOpen = false;

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
  $: hasInfo = !!(currentImage?.title || currentImage?.description || currentImage?.date);
  $: hasExtraDetails = !!(
    currentImage?.description ||
    currentImage?.date ||
    (currentImage?.tags && currentImage.tags.length > 0)
  );

  // Resolve displayed src per slide: full-res if loaded, otherwise thumbnail
  function resolvedSrc(filteredIdx: number): string {
    const origIdx = filteredMap[filteredIdx];
    if (origIdx != null && loadedFullRes.has(origIdx)) {
      return filteredImages[filteredIdx].fullSrc;
    }
    return filteredImages[filteredIdx].src;
  }

  // Preload a full-res image; when it finishes mark it as loaded
  function preloadFullRes(filteredIdx: number) {
    const origIdx = filteredMap[filteredIdx];
    if (origIdx == null || loadedFullRes.has(origIdx)) return;

    const img = new Image();
    img.onload = () => onFullResLoad(origIdx);
    img.src = filteredImages[filteredIdx].fullSrc;
  }

  // Preload adjacent full-res images so next/prev are ready
  $: if (isOpen && filteredImages.length > 0) {
    for (const offset of [-1, 0, 1, 2]) {
      const idx = (activeIndex + offset + filteredImages.length) % filteredImages.length;
      preloadFullRes(idx);
    }
  }

  async function open(index: number, filter?: string) {
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
    initialSlide = filteredIndex >= 0 ? filteredIndex : 0;
    activeIndex = initialSlide;

    // Start collapsed on mobile for maximum image area
    mobileInfoOpen = false;

    isOpen = true;
    document.body.style.overflow = "hidden";
    document.querySelector("nav")?.classList.add("lightbox-hidden");
    document.getElementById("floating-top")?.classList.add("lightbox-hidden");

    // Wait for DOM mount + two frames so CSS grid resolves before Swiper measures
    await tick();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        initSwiper();
        refreshSwiper();
      });
    });
  }

  function close() {
    isOpen = false;
    mobileInfoOpen = false;
    document.body.style.overflow = "";
    document.querySelector("nav")?.classList.remove("lightbox-hidden");
    document.getElementById("floating-top")?.classList.remove("lightbox-hidden");

    if (swiperInstance) {
      swiperInstance.destroy(true, true);
      swiperInstance = null;
    }
  }

  function initSwiper() {
    if (!swiperContainer) return;

    // On mobile, measure the panel and set swiper height to fill the rest of the viewport
    if (window.innerWidth <= 768) {
      const panel = swiperContainer.parentElement?.querySelector('.lightbox-panel') as HTMLElement;
      const panelH = panel ? panel.getBoundingClientRect().height : 110;
      swiperContainer.style.height = `calc(100dvh - ${panelH}px)`;
    }

    const prevBtn = swiperContainer.querySelector(".lightbox-prev") as HTMLElement;
    const nextBtn = swiperContainer.querySelector(".lightbox-next") as HTMLElement;

    swiperInstance = new Swiper(swiperContainer, {
      modules: [Navigation, Keyboard],
      initialSlide,
      slidesPerView: 1,
      spaceBetween: 0,
      rewind: true,
      observer: true,
      observeParents: true,
      keyboard: {
        enabled: true,
        onlyInViewport: false
      },
      navigation: {
        nextEl: nextBtn,
        prevEl: prevBtn
      },
      on: {
        slideChange(swiper) {
          activeIndex = swiper.activeIndex;

          // Keep mobile minimal by collapsing extra details on each new slide
          if (window.innerWidth <= 768) {
            mobileInfoOpen = false;
          }
        }
      }
    });

    // Force-update after init so Swiper recalculates with correct dimensions
    if (window.innerWidth <= 768) {
      swiperInstance.update();
    }
  }

  function refreshSwiper() {
    if (!swiperInstance) return;
    swiperInstance.update();
  }

  function toggleMobileInfo() {
    mobileInfoOpen = !mobileInfoOpen;
    refreshSwiper();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      close();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("resize", refreshSwiper);
    window.addEventListener("orientationchange", refreshSwiper);

    const handleLightboxOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      open(detail.index, detail.filter);
    };
    document.addEventListener("lightbox:open", handleLightboxOpen);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("resize", refreshSwiper);
      window.removeEventListener("orientationchange", refreshSwiper);
      document.removeEventListener("lightbox:open", handleLightboxOpen);

      if (isOpen) {
        document.body.style.overflow = "";
        document.querySelector("nav")?.classList.remove("lightbox-hidden");
        document.getElementById("floating-top")?.classList.remove("lightbox-hidden");
      }
    };
  });
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div
    class="lightbox-backdrop"
    on:click={handleBackdropClick}
    transition:fade={{ duration: 200 }}
    role="dialog"
    aria-modal="true"
  >
    <!-- Main layout wrapper -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="lightbox-layout" class:has-info={hasInfo} on:click|stopPropagation>
      <!-- Image area -->
      <div bind:this={swiperContainer} class="swiper lightbox-swiper">
        <div class="swiper-wrapper">
          {#each filteredImages as image, i}
            <div class="swiper-slide">
              <div class="lightbox-slide-inner">
                <img
                  src={resolvedSrc(i)}
                  width={image.width}
                  height={image.height}
                  alt={image.title || "Artwork"}
                  class="lightbox-img"
                  class:is-thumb={!loadedFullRes.has(filteredMap[i])}
                  draggable="false"
                />
              </div>
            </div>
          {/each}
        </div>

        <div class="lightbox-prev swiper-button-prev"></div>
        <div class="lightbox-next swiper-button-next"></div>
      </div>

      <!-- Side / bottom panel -->
      <aside class="lightbox-panel">
        <!-- Close -->
        <button class="lightbox-close" on:click={close} aria-label="Close lightbox">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <!-- Counter -->
        <div class="panel-counter">
          <span class="counter-current">{String(activeIndex + 1).padStart(2, "0")}</span>
          <div class="counter-bar">
            <div
              class="counter-fill"
              style="width: {((activeIndex + 1) / Math.max(filteredImages.length, 1)) * 100}%"
            ></div>
          </div>
          <span class="counter-total">{String(filteredImages.length).padStart(2, "0")}</span>
        </div>

        <!-- Mobile info toggle -->
        {#if hasExtraDetails}
          <button
            class="panel-info-toggle"
            on:click={toggleMobileInfo}
            aria-expanded={mobileInfoOpen}
            aria-controls="lightbox-mobile-details"
          >
            {mobileInfoOpen ? "Hide info" : "Show info"}
          </button>
        {/if}

        <div class="panel-divider"></div>

        {#key activeIndex}
          <div class="panel-meta" in:fly={{ y: 12, duration: 250, delay: 80 }}>
            {#if currentImage?.title}
              <h2 class="panel-title">{currentImage.title}</h2>
            {:else}
              <h2 class="panel-title panel-title--untitled">Untitled</h2>
            {/if}
          </div>
        {/key}

        <div
          id="lightbox-mobile-details"
          class="panel-details"
          class:mobile-open={mobileInfoOpen}
        >
          {#if currentImage?.description}
            <p class="panel-description">{currentImage.description}</p>
          {/if}

          {#if currentImage?.date}
            <span class="panel-date">{currentImage.date}</span>
          {/if}

          {#if currentImage?.tags?.length}
            <div class="panel-tags">
              {#each currentImage.tags as tag}
                <span class="panel-tag">{tag}</span>
              {/each}
            </div>
          {/if}
        </div>

        <div class="panel-accent-shape"></div>
      </aside>
    </div>
  </div>
{/if}

<style>
  .lightbox-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.92);
  }

  .lightbox-layout {
    display: flex;
    width: 95vw;
    height: 92vh;
    gap: 0;
    overflow: hidden;
    border-radius: 12px;
  }

  /* Image swiper area */
  .lightbox-swiper {
    flex: 1;
    min-width: 0;
    min-height: 0;
    height: 100%;
    --swiper-navigation-color: var(--accent-color);
    --swiper-navigation-size: 24px;
  }

  .lightbox-swiper :global(.swiper-slide) {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .lightbox-swiper :global(.swiper-button-prev),
  .lightbox-swiper :global(.swiper-button-next) {
    color: var(--accent-color);
    z-index: 10;
  }

  .lightbox-swiper :global(.swiper-button-prev:hover),
  .lightbox-swiper :global(.swiper-button-next:hover) {
    opacity: 0.7;
  }

  .lightbox-slide-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .lightbox-img {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    user-select: none;
    transition: filter 0.35s ease;
  }

  .lightbox-img.is-thumb {
    filter: blur(8px);
  }

  /* Side panel desktop */
  .lightbox-panel {
    width: 300px;
    flex-shrink: 0;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "counter close"
      "divider divider"
      "meta meta"
      "details details";
    align-content: start;
    row-gap: 0.9rem;
    column-gap: 0.75rem;
    padding: 1.25rem;
    background: rgba(20, 18, 22, 0.95);
    border-left: 1px solid rgba(255, 255, 255, 0.06);
    position: relative;
    overflow: hidden;
  }

  .lightbox-close {
    grid-area: close;
    justify-self: end;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.6);
    background: transparent;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .lightbox-close:hover {
    background: var(--accent-color);
    color: var(--primary-color);
    border-color: var(--accent-color);
    transform: rotate(90deg);
  }

  .panel-counter {
    grid-area: counter;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
  }

  .counter-current {
    color: var(--accent-color);
    font-size: 1.5rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .counter-bar {
    flex: 1;
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
  }

  .counter-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-color), var(--secondary-color));
    border-radius: 3px;
    transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .counter-total {
    color: rgba(255, 255, 255, 0.3);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .panel-info-toggle {
    display: none; /* shown on mobile */
  }

  .panel-divider {
    grid-area: divider;
    width: 32px;
    height: 2px;
    background: var(--accent-color);
    border-radius: 2px;
    opacity: 0.6;
  }

  .panel-meta {
    grid-area: meta;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }

  .panel-title {
    color: white;
    font-size: 1.15rem;
    font-weight: 600;
    line-height: 1.3;
    margin: 0;
    letter-spacing: 0.01em;
  }

  .panel-title--untitled {
    color: rgba(255, 255, 255, 0.25);
    font-style: italic;
  }

  .panel-details {
    grid-area: details;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    min-width: 0;
  }

  .panel-description {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.85rem;
    line-height: 1.5;
    margin: 0;
    overflow-wrap: anywhere;
  }

  .panel-date {
    color: rgba(255, 255, 255, 0.3);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.03em;
  }

  .panel-tags {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-top: 0.2rem;
  }

  .panel-tag {
    padding: 0.2rem 0.65rem;
    border-radius: 9999px;
    border: 1px solid var(--accent-color);
    color: var(--accent-color);
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .panel-accent-shape {
    position: absolute;
    bottom: -60px;
    right: -60px;
    width: 180px;
    height: 180px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--accent-color) 0%, transparent 70%);
    opacity: 0.06;
    pointer-events: none;
  }

  /* Mobile portrait / narrow screens */
  @media (max-width: 768px) {
    .lightbox-layout {
      display: flex;
      flex-direction: column;
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      border-radius: 0;
      overflow: hidden;
    }

    /* Fallback CSS height; JS overrides with exact calc once panel is measured */
    .lightbox-swiper {
      width: 100%;
      height: calc(100vh - 110px);
      height: calc(100dvh - 110px);
      flex-shrink: 0;
      overflow: hidden;
    }

    .lightbox-slide-inner {
      width: 100%;
      height: 100%;
      padding: 0.5rem;
    }

    .lightbox-img {
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
    }

    .lightbox-swiper :global(.swiper-button-prev),
    .lightbox-swiper :global(.swiper-button-next) {
      --swiper-navigation-size: 18px;
    }

    .lightbox-panel {
      width: 100%;
      grid-template-columns: auto 1fr auto;
      grid-template-areas:
        "close counter info"
        "meta meta meta"
        "details details details";
      padding: 0.7rem 0.95rem calc(0.8rem + env(safe-area-inset-bottom));
      row-gap: 0.5rem;
      column-gap: 0.55rem;
      border-left: none;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(20, 18, 22, 0.97);
    }

    .panel-counter {
      gap: 0.5rem;
    }

    .counter-current {
      font-size: 1.15rem;
    }

    .counter-total {
      font-size: 0.78rem;
    }

    .panel-info-toggle {
      grid-area: info;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 32px;
      padding: 0 0.7rem;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: transparent;
      color: rgba(255, 255, 255, 0.85);
      font-size: 0.72rem;
      letter-spacing: 0.03em;
      cursor: pointer;
    }

    .panel-info-toggle:hover {
      border-color: var(--accent-color);
      color: var(--accent-color);
    }

    .panel-divider {
      display: none;
    }

    .panel-meta {
      min-width: 0;
    }

    .panel-title {
      font-size: 0.92rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Minimal mode: hidden until user taps Show info */
    .panel-details {
      display: none;
      max-height: min(34dvh, 220px);
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      padding-top: 0.1rem;
    }

    .panel-details.mobile-open {
      display: flex;
    }

    .panel-description {
      font-size: 0.78rem;
      line-height: 1.45;
    }

    .panel-date {
      font-size: 0.72rem;
    }

    .panel-tag {
      font-size: 0.64rem;
      padding: 0.18rem 0.58rem;
    }

    .panel-accent-shape {
      display: none;
    }

    .lightbox-close {
      width: 32px;
      height: 32px;
    }
  }
</style>
