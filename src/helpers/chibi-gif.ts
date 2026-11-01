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

const newContext = (size: number) => Object.assign(document.createElement("canvas"), { width: size, height: size }).getContext("2d", { willReadFrequently: true })!;

// Grows the figure's silhouette by `width` px and paints it in the outline colour. It works in a
// horizontal pass then a vertical one, which gives the same square reach as the preview's filter,
// in far fewer draws than stamping in every direction.
function drawOutline(target: CanvasRenderingContext2D, figure: HTMLCanvasElement, width: number, color: string, scratch: CanvasRenderingContext2D[]) {
  const [shape, wide] = scratch;
  const size = figure.width;
  const stepBy = Math.max(1, width / 4);
  const offsets: number[] = [];
  for (let d = -width; d < width; d += stepBy) offsets.push(d);
  offsets.push(width);

  shape.globalCompositeOperation = "source-over";
  shape.clearRect(0, 0, size, size);
  shape.drawImage(figure, 0, 0);
  shape.globalCompositeOperation = "source-in";
  shape.fillStyle = color;
  shape.fillRect(0, 0, size, size);

  wide.clearRect(0, 0, size, size);
  for (const dx of offsets) wide.drawImage(shape.canvas, dx, 0);
  for (const dy of offsets) target.drawImage(wide.canvas, 0, dy);
}

/** A drawing surface for the card's layers, where they sit right now */
function pictureDrawer(card: HTMLElement, { background, size, outline }: PictureOptions) {
  const layers = [...card.querySelectorAll<HTMLCanvasElement>("canvas[data-part]")];
  const cssSize = layers[0].offsetWidth;
  const scale = size / cssSize;
  const output = newContext(size);
  const figure = newContext(size);
  const scratch = [newContext(size), newContext(size)];
  const outlineWidth = outline ? (outline.units * size) / CANVAS_UNITS : 0;

  // A transform as the browser applies it: around the element's transform-origin
  const transformOf = (el: Element) => {
    const style = getComputedStyle(el);
    const [ox, oy] = style.transformOrigin.split(" ").map(parseFloat);
    return new DOMMatrix().translate(ox, oy).multiply(new DOMMatrix(style.transform)).translate(-ox, -oy);
  };

  return (atRest = false) => {
    figure.setTransform(1, 0, 0, 1, 0, 0);
    figure.clearRect(0, 0, size, size);
    for (const layer of layers) {
      const parent = layer.parentElement!;
      const matrix = new DOMMatrix().scale(scale);
      figure.setTransform(atRest ? matrix : matrix.multiply(transformOf(parent)).multiply(transformOf(layer)));
      figure.drawImage(layer, 0, 0, cssSize, cssSize);
    }

    output.clearRect(0, 0, size, size);
    if (background) {
      output.fillStyle = background;
      output.fillRect(0, 0, size, size);
    }
    if (outline && outlineWidth > 0) drawOutline(output, figure.canvas, outlineWidth, outline.color, scratch);
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
// GIF pixels are fully solid or fully clear, so this is where a soft edge gets cut
const SOLID_FROM = 128;

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
