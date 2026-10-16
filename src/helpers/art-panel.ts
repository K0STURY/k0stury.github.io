import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Some pieces are an art panel inset on a plain grey canvas; others fill the whole image.
// Laid over each other in the then & now view, that canvas shows up as a stray margin and
// the two drawings don't line up, so the comparison zooms such pieces to their panel.

// Where the panel sits, as fractions of the image
export type ArtBox = { x: number; y: number; w: number; h: number };

const SHOWCASE = "src/assets/showcase";
const SAMPLE = 400; // analysed at this width; plenty to find a panel edge
const TOLERANCE = 18; // how far (per channel) a pixel may drift and still count as canvas

// Runs once per page, so remember each answer for the rest of the build
const cache = new Map<number, Promise<ArtBox | null>>();

export function getArtPanel(id: number): Promise<ArtBox | null> {
  if (!cache.has(id)) cache.set(id, findPanel(id).catch(() => null));
  return cache.get(id)!;
}

async function findPanel(id: number): Promise<ArtBox | null> {
  const file = fs.readdirSync(SHOWCASE).find((f) => f.startsWith(`${id}-`));
  if (!file) return null;

  const { data, info } = await sharp(path.join(SHOWCASE, file))
    .resize({ width: SAMPLE })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const at = (x: number, y: number) => (y * w + x) * 3;

  // The canvas: a light neutral grey/white in the corner. Anything else is full-bleed art.
  const [r, g, b] = [data[0], data[1], data[2]];
  if (Math.min(r, g, b) < 200 || Math.max(r, g, b) - Math.min(r, g, b) > 8) return null;

  const isCanvas = (x: number, y: number) => {
    const i = at(x, y);
    return (
      Math.abs(data[i] - r) <= TOLERANCE &&
      Math.abs(data[i + 1] - g) <= TOLERANCE &&
      Math.abs(data[i + 2] - b) <= TOLERANCE
    );
  };

  // How much of each column and row is art. The panel's columns and rows are mostly art;
  // bits of the drawing that overhang the panel (a hat brim, a wing) only add a little.
  const colArt = new Array(w).fill(0);
  const rowArt = new Array(h).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isCanvas(x, y)) continue;
      colArt[x]++;
      rowArt[y]++;
    }
  }

  const span = (counts: number[]) => {
    const cutoff = Math.max(...counts) / 2;
    const first = counts.findIndex((c) => c >= cutoff);
    const last = counts.length - 1 - [...counts].reverse().findIndex((c) => c >= cutoff);
    return [first, last];
  };
  const [left, right] = span(colArt);
  const [top, bottom] = span(rowArt);
  if (left < 0 || top < 0 || right - left < 10 || bottom - top < 10) return null;

  // A panel is a filled rectangle: its corners are art, not canvas. A character standing on
  // the canvas has canvas in those corners, and must not be cropped down to its outline.
  const inset = 3;
  const corners: [number, number][] = [
    [left + inset, top + inset],
    [right - inset, top + inset],
    [left + inset, bottom - inset],
    [right - inset, bottom - inset],
  ];
  if (corners.some(([x, y]) => isCanvas(x, y))) return null;

  const box = { x: left / w, y: top / h, w: (right - left + 1) / w, h: (bottom - top + 1) / h };
  // Barely any margin: nothing worth cropping
  if (box.w * box.h > 0.97) return null;
  return box;
}
