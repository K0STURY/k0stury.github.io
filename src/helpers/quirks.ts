// Hover quirks: every folder in src/assets/quirks is one, named after the folder and
// holding the shapes it can take; pieces list theirs under "quirks" in artwork.json.
// Each SVG becomes a mask (its shape, filled with the frame's white), inlined as a
// data URI so it's there the instant a sticker is hovered.
const quirkFiles = import.meta.glob<string>("../assets/quirks/*/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const quirkShapes: Record<string, string[]> = {};
for (const file of Object.keys(quirkFiles).sort()) {
  const quirk = file.split("/").at(-2)!;
  (quirkShapes[quirk] ??= []).push(`url("data:image/svg+xml,${encodeURIComponent(quirkFiles[file].trim())}")`);
}

// How many shapes each quirk has to pick from
export const quirkCounts: Record<string, number> = Object.fromEntries(
  Object.entries(quirkShapes).map(([quirk, masks]) => [quirk, masks.length]),
);

// Where a quirk sits: these drop one piece onto the frame's top-right corner; any
// other quirk is a pair (left + mirrored right) rising from behind the top edge
const CORNER_QUIRKS = new Set(["witch-hats"]);

// The shapes as custom properties (--horns-0, --ears-2, ...), for the style of
// whatever element holds the stickers
export const quirkStyle = Object.entries(quirkShapes)
  .flatMap(([quirk, masks]) => masks.map((mask, i) => `--${quirk}-${i}: ${mask};`))
  .join(" ");

// What a piece shows: at most one pair and one corner piece, the first of each listed
export function pickQuirks(quirks: string[]) {
  return {
    pair: quirks.find((quirk) => !CORNER_QUIRKS.has(quirk)) ?? null,
    corner: quirks.find((quirk) => CORNER_QUIRKS.has(quirk)) ?? null,
  };
}
