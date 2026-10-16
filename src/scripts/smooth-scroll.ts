import Lenis from "lenis";

declare global {
  interface Window {
    lenis?: Lenis;
  }
}

// One instance for the whole visit: View Transitions swap the DOM but keep `window`.
// Skipped entirely for reduced motion, everything falls back to native scrolling.
if (!window.lenis && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const lenis = new Lenis({ autoRaf: true });
  window.lenis = lenis;

  // The router has already jumped to the new page's scroll position by now.
  // Drop any glide still running from the old page and re-measure the new one.
  document.addEventListener("astro:after-swap", () => {
    lenis.start();
    lenis.reset();
    lenis.resize();
  });
}

// `offset` stops short of an element by that many pixels, e.g. to clear the fixed nav.
// Without smooth scrolling, the element's own scroll-margin-top does that job instead.
export function smoothScrollTo(target: number | HTMLElement, offset = 0) {
  if (window.lenis) {
    window.lenis.scrollTo(target, { offset: -offset });
  } else if (typeof target === "number") {
    window.scrollTo({ top: target, behavior: "smooth" });
  } else {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
