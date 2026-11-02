// Turns the Chibi Quil maker's live animation into a looping GIF, in the visitor's browser.
// The frames are read off the animations themselves, so a GIF always matches the sliders.

// The settings, picked by comparing real exports of the art at 512px: 128 colours were very hard to tell
// from the original even zoomed in, while 64 starts to roughen the curves and 32 is plainly jagged.
// Quil moves slowly, so 20 frames a second is smooth, and more only adds size.
export const GIF_FRAME_MS = 50;

export type GifOptions = {
  size: number; // px, square
  maxColors?: number;
  format?: "rgb565" | "rgb444";
  transparent?: boolean; // captured with no background
};

export type CapturedFrames = { frames: Uint8ClampedArray[]; frameMs: number };

export type PictureOptions = {
  background: string | null; // null for see-through
  size: number; // px, square
  outline?: { units: number; color: string } | null; // units are on the 5000 canvas, so it scales with size
};

const MAX_FRAMES = 120; // a very slow speed setting shouldn't make an enormous file
const CANVAS_UNITS = 5000;
// GIF pixels are fully solid or fully clear, so this is where a soft edge gets cut
const SOLID_FROM = 128;

const newContext = (size: number) => Object.assign(document.createElement("canvas"), { width: size, height: size }).getContext("2d", { willReadFrequently: true })!;

// A smooth outline. Rather than tracing every notch, it rolls a ball around the outside of the shape:
// where the ball can't fit between two bits that stick out, like fur tufts, the outline bridges
// across in one curve. The result is then grown by the outline's width. Both steps come from
// distance fields (Felzenszwalb's distance transform), worked out only around the shape itself.
const BRIDGE_UNITS = 150; // the ball's radius on the 5000 canvas: bigger bridges wider gaps

export function outliner(size: number) {
  const FAR = 1e12;
  const bridge = (BRIDGE_UNITS * size) / CANVAS_UNITS;
  const fromShape = new Float64Array(size * size);
  const fromOpen = new Float64Array(size * size);
  const line = new Float64Array(size);
  const parabolas = new Int32Array(size);
  const starts = new Float64Array(size + 1);
  const paper = newContext(size);
  const picture = paper.createImageData(size, size);

  // One row or column of a field, in place: `step` is how far apart its pixels sit
  const sweep = (field: Float64Array, from: number, step: number, count: number) => {
    let seen = false;
    for (let i = 0; i < count; i++) {
      line[i] = field[from + i * step];
      seen ||= line[i] < FAR;
    }
    if (!seen) return;
    let last = 0;
    parabolas[0] = 0;
    starts[0] = -Infinity;
    starts[1] = Infinity;
    for (let q = 1; q < count; q++) {
      let s = 0;
      for (;;) {
        const v = parabolas[last];
        s = (line[q] + q * q - line[v] - v * v) / (2 * (q - v));
        if (s > starts[last]) break;
        last--;
      }
      last++;
      parabolas[last] = q;
      starts[last] = s;
      starts[last + 1] = Infinity;
    }
    last = 0;
    for (let q = 0; q < count; q++) {
      while (starts[last + 1] < q) last++;
      const v = parabolas[last];
      field[from + q * step] = (q - v) * (q - v) + line[v];
    }
  };

  return (target: CanvasRenderingContext2D, figure: CanvasRenderingContext2D, width: number, color: string) => {
    const solid = figure.getImageData(0, 0, size, size).data;
    let [left, top, right, bottom] = [size, size, -1, -1];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (solid[(y * size + x) * 4 + 3] < SOLID_FROM) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    if (right < 0) return; // nothing to go round

    const reach = Math.ceil(bridge * 2 + width) + 2; // room for the ball outside the shape
    const x0 = Math.max(0, left - reach);
    const y0 = Math.max(0, top - reach);
    const w = Math.min(size, right + reach + 1) - x0;
    const h = Math.min(size, bottom + reach + 1) - y0;
    const fill = (field: Float64Array, value: (p: number) => number) => {
      for (let y = y0; y < y0 + h; y++) {
        for (let p = y * size + x0; p < y * size + x0 + w; p++) field[p] = value(p);
      }
      for (let x = x0; x < x0 + w; x++) sweep(field, y0 * size + x, size, h);
      for (let y = y0; y < y0 + h; y++) sweep(field, y * size + x0, 1, w);
    };

    // Where the ball's centre can go is anywhere at least its radius from the shape...
    fill(fromShape, (p) => (solid[p * 4 + 3] >= SOLID_FROM ? 0 : FAR));
    const ballFits = bridge * bridge;
    fill(fromOpen, (p) => (fromShape[p] >= ballFits ? 0 : FAR));

    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    const px = picture.data;
    for (let y = y0; y < y0 + h; y++) {
      for (let p = y * size + x0; p < y * size + x0 + w; p++) {
        const c = p * 4;
        px[c] = r;
        px[c + 1] = g;
        px[c + 2] = b;
        // ...so the smooth edge is one radius from those centres, and the outline's width past that.
        // Fades over the last pixel, so the outer edge is smooth.
        const pastEdge = Math.max(0, bridge - Math.sqrt(fromOpen[p]));
        px[c + 3] = 255 * Math.max(0, Math.min(1, width + 0.5 - pastEdge));
      }
    }
    paper.clearRect(0, 0, size, size);
    paper.putImageData(picture, 0, 0, x0, y0, w, h);
    target.drawImage(paper.canvas, 0, 0);
  };
}

/** A drawing surface for the card's layers, where they sit right now */
function pictureDrawer(card: HTMLElement, { background, size, outline }: PictureOptions) {
  const layers = [...card.querySelectorAll<HTMLCanvasElement>("canvas[data-part]")];
  const cssSize = layers[0].offsetWidth;
  const scale = size / cssSize;
  const output = newContext(size);
  const figure = newContext(size);

  // A transform as the browser applies it: around the element's transform-origin
  const transformOf = (el: Element) => {
    const style = getComputedStyle(el);
    const [ox, oy] = style.transformOrigin.split(" ").map(parseFloat);
    return new DOMMatrix().translate(ox, oy).multiply(new DOMMatrix(style.transform)).translate(-ox, -oy);
  };

  // One outline a part, like the preview: worked out once here, then each moves with its part
  const outlineWidth = outline ? (outline.units * size) / CANVAS_UNITS : 0;
  const outlines: HTMLCanvasElement[] = [];
  if (outline && outlineWidth > 0) {
    const grow = outliner(size);
    for (const layer of layers) {
      const silhouette = newContext(size);
      silhouette.drawImage(layer, 0, 0, size, size);
      const shape = newContext(size);
      grow(shape, silhouette, outlineWidth, outline.color);
      outlines.push(shape.canvas);
    }
  }

  return (atRest = false) => {
    const matrices = layers.map((layer) => {
      const matrix = new DOMMatrix().scale(scale);
      return atRest ? matrix : matrix.multiply(transformOf(layer.parentElement!)).multiply(transformOf(layer));
    });

    figure.setTransform(1, 0, 0, 1, 0, 0);
    figure.clearRect(0, 0, size, size);
    layers.forEach((layer, i) => {
      figure.setTransform(matrices[i]);
      figure.drawImage(layer, 0, 0, cssSize, cssSize);
    });

    output.setTransform(1, 0, 0, 1, 0, 0);
    output.clearRect(0, 0, size, size);
    if (background) {
      output.fillStyle = background;
      output.fillRect(0, 0, size, size);
    }
    outlines.forEach((shape, i) => {
      output.setTransform(matrices[i]);
      output.drawImage(shape, 0, 0, cssSize, cssSize);
    });
    output.setTransform(1, 0, 0, 1, 0, 0);
    output.drawImage(figure.canvas, 0, 0);
    return output;
  };
}

/** One still picture, with Quil at rest */
export function capturePicture(card: HTMLElement, options: PictureOptions) {
  return pictureDrawer(card, options)(true).canvas;
}

/** Draws one full loop, frame by frame, from the animations running on the card's layers */
export function captureFrames(card: HTMLElement, options: PictureOptions, frameMs: number): CapturedFrames {
  const { size } = options;
  const animations = [...card.querySelectorAll<HTMLElement>("*")].flatMap((el) => el.getAnimations());
  // A pop from the last click isn't part of the loop: get it out of the way first
  const isLoop = (animation: Animation) => animation.effect?.getTiming().iterations === Infinity;
  animations.filter((animation) => !isLoop(animation)).forEach((animation) => animation.finish());
  const moving = animations.filter(isLoop);
  const loopMs = Math.max(0, ...moving.map((animation) => Number(animation.effect?.getTiming().duration) || 0));

  // GIF timing only goes in steps of 10ms. A long loop gets longer frames instead of too many of them.
  const actualMs = Math.max(frameMs, Math.ceil(loopMs / MAX_FRAMES / 10) * 10);
  const count = Math.max(1, Math.round(loopMs / actualMs));
  const draw = pictureDrawer(card, options);

  const wasPaused = moving.map((animation) => animation.playState === "paused");
  const startedAt = moving.map((animation) => animation.currentTime);
  moving.forEach((animation) => animation.pause());

  const frames: Uint8ClampedArray[] = [];
  for (let i = 0; i < count; i++) {
    const at = (i / count) * loopMs;
    moving.forEach((animation) => (animation.currentTime = at));
    frames.push(draw().getImageData(0, 0, size, size).data);
  }

  moving.forEach((animation, i) => {
    animation.currentTime = startedAt[i];
    if (!wasPaused[i]) animation.play();
  });
  return { frames, frameMs: actualMs };
}

// How far a colour channel can drift (out of 255) and still count as the same colour
const SAME_COLOUR = 6;

/** Encodes captured frames. gifenc is only downloaded the first time someone asks for a GIF. */
export async function encodeGif({ frames, frameMs }: CapturedFrames, options: GifOptions) {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const { size, maxColors = 128, format = "rgb565", transparent = false } = options;

  // One palette for the whole loop: smaller than one per frame. It learns from frames spread across
  // the loop, so nothing that only shows part-way through gets left out. Clear pixels don't count.
  const step = Math.max(1, Math.floor(frames.length / 8));
  const samples = frames.filter((_, i) => i % step === 0);
  const sampled = new Uint8ClampedArray(samples.length * frames[0].length);
  let filled = 0;
  for (const frame of samples) {
    for (let c = 0; c < frame.length; c += 4) {
      if (frame[c + 3] < SOLID_FROM) continue;
      sampled.set(frame.subarray(c, c + 4), filled);
      filled += 4;
    }
  }
  const palette = quantize(sampled.subarray(0, filled), maxColors - 1, { format });

  // A palette slot of its own that no real pixel uses. On a solid background it means "keep what's
  // there", since most of the picture holds still and that compresses far better. On a clear
  // background it means see-through, and each frame has to be complete: a "keep" there could never
  // clear a pixel once something had moved away, leaving trails.
  const special = palette.length;

  // What stops flicker: moving a layer by a fraction of a pixel nudges its flat colours by a hair,
  // which can flip a whole area over to the next palette shade. So a pixel only updates once it's
  // really different from what's on screen.
  const shown = new Uint8ClampedArray(frames[0].length);
  const shownIndex = new Uint8Array(frames[0].length / 4).fill(special);

  const gif = GIFEncoder();
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const index: Uint8Array = applyPalette(frame, palette, format);
    for (let p = 0; p < index.length; p++) {
      const c = p * 4;
      if (frame[c + 3] < SOLID_FROM) {
        index[p] = shownIndex[p] = special;
        continue;
      }
      const same =
        shownIndex[p] !== special &&
        Math.abs(frame[c] - shown[c]) <= SAME_COLOUR &&
        Math.abs(frame[c + 1] - shown[c + 1]) <= SAME_COLOUR &&
        Math.abs(frame[c + 2] - shown[c + 2]) <= SAME_COLOUR;
      if (same) {
        index[p] = transparent ? shownIndex[p] : special;
      } else {
        shown[c] = frame[c];
        shown[c + 1] = frame[c + 1];
        shown[c + 2] = frame[c + 2];
        shownIndex[p] = index[p];
      }
    }
    gif.writeFrame(index, size, size, {
      palette: i === 0 ? [...palette, [0, 0, 0]] : undefined,
      delay: frameMs,
      repeat: 0,
      transparent: true,
      transparentIndex: special,
      dispose: transparent ? 2 : 1, // 2 clears the frame before the next one, 1 leaves it in place
    });
    if (i % 8 === 7) await new Promise((resolve) => setTimeout(resolve)); // keeps the page responsive
  }
  gif.finish();
  return gif.bytes() as Uint8Array;
}
