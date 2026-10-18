// Every hover (or keyboard focus) deals each of a sticker's quirks a shape from its
// folder in src/assets/quirks, never the same one twice running.
// Each quirk element carries data-quirk (its name) and data-count (shapes to pick from).
export function dealQuirksOnHover(host: HTMLElement) {
  const deal = () => {
    host.querySelectorAll<HTMLElement>("[data-quirk]").forEach((quirk) => {
      const count = Number(quirk.dataset.count ?? 0);
      if (count < 2) return; // nothing to pick between: shape 0 is the default
      const shown = Number(quirk.dataset.shown ?? -1);
      let next = shown;
      while (next === shown) next = Math.floor(Math.random() * count);
      quirk.dataset.shown = String(next);
      quirk.style.setProperty("--shape", `var(--${quirk.dataset.quirk}-${next})`);
    });
  };
  host.addEventListener("mouseenter", deal);
  host.addEventListener("focusin", deal);
}
