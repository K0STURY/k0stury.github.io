// A piece's main colours, read in the browser from its thumbnail.

const SAMPLE = 64; // analysed at this size; plenty for the big colour areas
const MIN_DISTANCE = 60; // colours closer than this count as the same one

/** The main colours in RGBA pixel data, as hex. Vivid colours beat greys of the same area. */
export function pickPalette(rgba: ArrayLike<number>, count = 5): string[] {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue; // see-through
    const key = ((rgba[i] >> 4) << 8) | ((rgba[i + 1] >> 4) << 4) | (rgba[i + 2] >> 4);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bucket.r += rgba[i];
    bucket.g += rgba[i + 1];
    bucket.b += rgba[i + 2];
    bucket.n++;
    buckets.set(key, bucket);
  }

  const colors = [...buckets.values()]
    .map(({ r, g, b, n }) => {
      const rgb = [r / n, g / n, b / n].map(Math.round);
      const vividness = (Math.max(...rgb) - Math.min(...rgb)) / 255;
      return { rgb, score: n * (1 + 2 * vividness) };
    })
    .sort((a, b) => b.score - a.score);

  const picked: number[][] = [];
  for (const { rgb } of colors) {
    if (picked.length === count) break;
    if (picked.every((other) => Math.hypot(...rgb.map((v, i) => v - other[i])) >= MIN_DISTANCE)) picked.push(rgb);
  }
  return picked.map((rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`);
}

export async function getPalette(src: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SAMPLE;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(img, 0, 0, SAMPLE, SAMPLE);
  return pickPalette(context.getImageData(0, 0, SAMPLE, SAMPLE).data);
}
