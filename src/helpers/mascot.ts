import { getImage } from "astro:assets";

type Files = Record<string, { default: ImageMetadata }>;

const stills: Files = import.meta.glob("../assets/mascot/*.{png,webp,svg}", { eager: true });
const allFrames: Files = import.meta.glob("../assets/mascot/*/*.{png,webp,svg}", { eager: true });

// Frames by animation, which is whatever their folder is called
const folders: Record<string, Files> = { still: stills };
for (const [path, file] of Object.entries(allFrames)) {
  const folder = path.split("/").at(-2)!;
  (folders[folder] ??= {})[path] = file;
}

// Each folder's timing.json: how long each frame shows, in ms ([frame 1, frame 2, ...])
const timings: Record<string, { default: number[] }> = import.meta.glob("../assets/mascot/*/timing.json", {
  eager: true,
});
// For frames the timing.json doesn't cover (or a folder without one)
const DEFAULT_MS = 150;
const QUICK_MS: Record<string, number> = { click: 75, like: 75 };

// Frames are named like the art (1_idle.png, 2_idle.png...) and play in index order
const frameNo = (path: string) => parseInt(path.split("/").pop()!);

/** The mascot's frames for one animation folder, in order ("still" = only the first loose image) */
export async function getMascotFrames(anim: string) {
  const files = folders[anim] ?? {};
  const ms = timings[`../assets/mascot/${anim}/timing.json`]?.default ?? [];
  const keys = Object.keys(files).sort((a, b) => frameNo(a) - frameNo(b) || a.localeCompare(b));
  return Promise.all(
    keys.slice(0, anim === "still" ? 1 : undefined).map(async (k, i) => ({
      src: (await getImage({ src: files[k].default, format: "webp", width: 640 })).src,
      ms: ms[i] ?? QUICK_MS[anim] ?? DEFAULT_MS,
    })),
  );
}

/** Every animation that has frames */
export function getMascotAnimations() {
  return Object.keys(folders).filter((name) => name !== "still");
}
