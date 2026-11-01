import { getImage } from "astro:assets";
import ORDER from "../assets/chibi/order.json"; // the layers, back to front
import positions from "../assets/chibi/positions.json";

// The Chibi Quil maker's parts: src/assets/chibi/<part>/<any name>.png, each file a variant.
// How to add more: src/assets/chibi/README.md

export const CANVAS = 5000;
const SERVED_SCALE = 0.4; // of the source size: the maker draws at 1400px, this stays sharp

// Files are named Name_1.png, Name_2.png...: they run in that order, and _1 is the default look
const variantNo = (path: string) => Number(path.match(/_(\d+)\.png$/i)?.[1] ?? Infinity);

const files = import.meta.glob<{ default: ImageMetadata }>("../assets/chibi/*/*.png", { eager: true });
const spots = positions as Record<string, { x: number; y: number }>;

export async function getChibiParts() {
  const parts = await Promise.all(
    ORDER.map(async (name) => {
      const paths = Object.keys(files).filter((path) => path.split("/").at(-2) === name).sort((a, b) => variantNo(a) - variantNo(b));
      const variants = await Promise.all(
        paths.map(async (path) => {
          const image = files[path].default;
          // Read the size off a copy: reading it off the import makes Astro ship the original
          const info = ((image as any).clone ?? image) as ImageMetadata;
          const served = await getImage({ src: image, format: "webp", width: Math.round(info.width * SERVED_SCALE) });
          const key = path.split("/").slice(-2).join("/");
          // Each position is from the canvas's centre to the file's centre; no entry means centred
          const spot = spots[key] ?? { x: 0, y: 0 };
          return {
            src: served.src,
            x: CANVAS / 2 + spot.x - info.width / 2,
            y: CANVAS / 2 + spot.y - info.height / 2,
            w: info.width,
            h: info.height,
          };
        }),
      );
      return { name, variants };
    }),
  );
  return parts.filter((part) => part.variants.length > 0);
}
