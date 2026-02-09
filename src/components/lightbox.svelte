<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import Swiper from "swiper";
  import { Navigation, Keyboard, Zoom } from "swiper/modules";
  import "swiper/css";
  import "swiper/css/navigation";
  import "swiper/css/zoom";

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

  // Track which full-res images have loaded
  let loadedFullRes = new Set<number>();

  function onFullResLoad(index: number) {
    loadedFullRes.add(index);
    loadedFullRes = loadedFullRes; // trigger reactivity
  }

  // Preload a full-res image; when it finishes mark it as loaded
  function preloadFullRes(filteredIdx: number) {
    const origIdx = filteredMap[filteredIdx];
    if (origIdx == null || loadedFullRes.has(origIdx)) return;
    const img = new Image();
    img.onload = () => onFullResLoad(origIdx);
    img.src = filteredImages[filteredIdx].fullSrc;
  }

  let isOpen = false;
  let initialSlide = 0;
  let activeIndex = 0;
  let swiperInstance: Swiper | null = null;
  let swiperContainer: HTMLElement;

  // Filtered subset of images based on active gallery tag
  let filteredImages: typeof images = images;
  // Map from filtered index back to original index (for full-res tracking)
  let filteredMap: number[] = [];

  $: currentImage = filteredImages[activeIndex] || null;
  $: hasInfo = currentImage?.title || currentImage?.description;

  // Resolve displayed src per slide: full-res if loaded, otherwise thumbnail
  function resolvedSrc(filteredIdx: number): string {
    const origIdx = filteredMap[filteredIdx];
    if (origIdx != null && loadedFullRes.has(origIdx)) {
      return filteredImages[filteredIdx].fullSrc;
    }
    return filteredImages[filteredIdx].src;
  }

  // Preload adjacent full-res images so next/prev are ready
  $: if (isOpen && filteredImages.length > 0) {
    for (const offset of [-1, 0, 1, 2]) {
      const idx = (activeIndex + offset + filteredImages.length) % filteredImages.length;
      preloadFullRes(idx);
    }
  }

  function open(index: number, filter?: string) {
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

    isOpen = true;
    document.body.style.overflow = "hidden";
    document.querySelector("nav")?.classList.add("lightbox-hidden");
    document.getElementById("floating-top")?.classList.add("lightbox-hidden");
    // Double-rAF so mobile has time to compute the flex layout before Swiper reads dimensions
    requestAnimationFrame(() => requestAnimationFrame(() => initSwiper()));
  }

  function close() {
    isOpen = false;
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

    swiperInstance = new Swiper(swiperContainer, {
      modules: [Navigation, Keyboard, Zoom],
      initialSlide,
      slidesPerView: 1,
      spaceBetween: 0,
      loop: true,
      observer: true,
      observeParents: true,
      keyboard: {
        enabled: true,
        onlyInViewport: false,
      },
      zoom: {
        maxRatio: 3,
        minRatio: 1,
      },
      navigation: {
        nextEl: ".lightbox-next",
        prevEl: ".lightbox-prev",
      },
      on: {
        slideChange(swiper) {
          activeIndex = swiper.realIndex;
        },
      },
    });
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

    const handleLightboxOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      open(detail.index, detail.filter);
    };
    document.addEventListener("lightbox:open", handleLightboxOpen);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
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
      <div
        bind:this={swiperContainer}
        class="swiper lightbox-swiper"
      >
        <div class="swiper-wrapper">
          {#each filteredImages as image, i}
            <div class="swiper-slide">
              <div class="swiper-zoom-container lightbox-slide-inner">
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

      <!-- Side panel -->
      <aside class="lightbox-panel">
        <!-- Close button -->
        <button
          class="lightbox-close"
          on:click={close}
          aria-label="Close lightbox"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <!-- Counter with animated bar -->
        <div class="panel-counter">
          <span class="counter-current">{String(activeIndex + 1).padStart(2, '0')}</span>
          <div class="counter-bar">
            <div class="counter-fill" style="width: {((activeIndex + 1) / filteredImages.length) * 100}%"></div>
          </div>
          <span class="counter-total">{String(filteredImages.length).padStart(2, '0')}</span>
        </div>

        <!-- Decorative divider -->
        <div class="panel-divider"></div>

        <!-- Title & description -->
        {#key activeIndex}
          <div class="panel-meta" in:fly={{ y: 12, duration: 250, delay: 80 }}>
            {#if currentImage?.title}
              <h2 class="panel-title">{currentImage.title}</h2>
            {:else}
              <h2 class="panel-title panel-title--untitled">Untitled</h2>
            {/if}

            {#if currentImage?.description}
              <p class="panel-description">{currentImage.description}</p>
            {/if}
            {#if currentImage?.date}
              <span class="panel-date">{currentImage.date}</span>
            {/if}
          </div>
        {/key}

        <!-- Tags -->
        {#if currentImage?.tags?.length}
          <div class="panel-tags">
            {#each currentImage.tags as tag}
              <span class="panel-tag">{tag}</span>
            {/each}
          </div>
        {/if}

        <!-- Decorative accent shape -->
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

  .lightbox-slide-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  /* Single image element — src swaps from thumb to full-res */
  .lightbox-img {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    user-select: none;
    transition: filter 0.4s ease;
  }

  .lightbox-img.is-thumb {
    filter: blur(8px);
  }

  /* Side panel */
  .lightbox-panel {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    padding: 1.25rem;
    gap: 1rem;
    background: rgba(20, 18, 22, 0.95);
    border-left: 1px solid rgba(255, 255, 255, 0.06);
    position: relative;
    overflow: hidden;
  }

  /* Close button */
  .lightbox-close {
    align-self: flex-end;
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

  /* Counter with progress bar */
  .panel-counter {
    display: flex;
    align-items: center;
    gap: 0.6rem;
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

  /* Divider */
  .panel-divider {
    width: 32px;
    height: 2px;
    background: var(--accent-color);
    border-radius: 2px;
    opacity: 0.6;
  }

  /* Meta info */
  .panel-meta {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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

  .panel-description {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.85rem;
    line-height: 1.5;
    margin: 0;
  }

  .panel-date {
    color: rgba(255, 255, 255, 0.3);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.03em;
  }

  /* Tags */
  .panel-tags {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-top: auto;
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

  /* Decorative accent shape */
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

  /* Responsive: stack vertically on narrow screens */
  @media (max-width: 768px) {
    .lightbox-layout {
      flex-direction: column;
      width: 100vw;
      height: 100dvh;
      border-radius: 0;
    }

    .lightbox-swiper {
      flex: 1;
      min-height: 0;
      height: auto;
      overflow: hidden;
    }

    .lightbox-img {
      max-width: 100%;
      max-height: 100%;
    }

    .lightbox-panel {
      width: 100%;
      flex-shrink: 0;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      padding: 0.75rem 1rem;
      gap: 0.6rem;
      border-left: none;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      max-height: 120px;
    }

    .lightbox-panel .panel-counter {
      order: 1;
      flex: 1;
    }

    .lightbox-panel .panel-divider {
      display: none;
    }

    .lightbox-panel .panel-meta {
      order: 3;
      flex-basis: 100%;
      flex-direction: row;
      gap: 0.5rem;
      align-items: baseline;
    }

    .lightbox-panel .panel-title {
      font-size: 0.9rem;
    }

    .lightbox-panel .panel-description {
      font-size: 0.75rem;
    }

    .lightbox-panel .panel-tags {
      order: 2;
      margin-top: 0;
    }

    .lightbox-panel .lightbox-close {
      order: 0;
    }

    .panel-accent-shape {
      display: none;
    }
  }
</style>