import { getImage } from "astro:assets";

type Files = Record<string, { default: ImageMetadata }>;

// One glob per folder: Vite needs them written out literally
const folders: Record<string, Files> = {
  still: import.meta.glob("../assets/mascot/*.{png,webp,svg}", { eager: true }),
  idle: import.meta.glob("../assets/mascot/idle/*.{png,webp,svg}", { eager: true }),
  click: import.meta.glob("../assets/mascot/click/*.{png,webp,svg}", { eager: true }),
  pop_up: import.meta.glob("../assets/mascot/pop_up/*.{png,webp,svg}", { eager: true }),
  zzz: import.meta.glob("../assets/mascot/zzz/*.{png,webp,svg}", { eager: true }),
};

// Each folder's timing.json: how long each frame shows, in ms ([frame 1, frame 2, ...])
const timings: Record<string, { default: number[] }> = import.meta.glob("../assets/mascot/*/timing.json", {
  eager: true,
});
// For frames the timing.json doesn't cover (or a folder without one)
const DEFAULT_MS = { still: 150, idle: 150, click: 75, pop_up: 150, zzz: 150 };

// Frames are named like the art (1_idle.png, 2_idle.png...) and play in index order
const frameNo = (path: string) => parseInt(path.split("/").pop()!);

/** The mascot's frames for one animation folder, in order ("still" = only the first loose image) */
export async function getMascotFrames(anim: keyof typeof DEFAULT_MS) {
  const files = folders[anim];
  const ms = timings[`../assets/mascot/${anim}/timing.json`]?.default ?? [];
  const keys = Object.keys(files).sort((a, b) => frameNo(a) - frameNo(b) || a.localeCompare(b));
  return Promise.all(
    keys.slice(0, anim === "still" ? 1 : undefined).map(async (k, i) => ({
      src: (await getImage({ src: files[k].default, format: "webp", width: 640 })).src,
      ms: ms[i] ?? DEFAULT_MS[anim],
    })),
  );
}
