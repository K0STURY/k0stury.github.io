import { getImage } from "astro:assets";
import getAllArt, { type Artworks } from "@api/art";
import { getLightboxImages } from "./lightbox-images";
import links from "@data/challenge.json";

// The 100-day challenge (/100-days): one file per piece in src/assets/challenge, named
// day_<day>.png, or day_<day>_<n>.png when a day had more than one piece.
// src/data/challenge.json links a file to its gallery piece ("day_38": 84) when it is in
// the gallery too; those open the gallery version, with its title and description.

export type ChallengePiece = {
  file: string; // "day_62_3"
  day: number;
  part: number; // 1-based, within its day
  partsThatDay: number;
  thumb: string;
  width: number;
  height: number;
  index: number; // into the lightbox's images
  label: string; // "Day 62, piece 3 of 4"
  featured: boolean; // also in the gallery: pinned up bigger on the wall
};

// What the lightbox shows per piece; challenge-only pieces carry their own address
type ViewerImage = Awaited<ReturnType<typeof getLightboxImages>>[number] & { page?: string };

// Thumbnails about this tall: the wall shows them at up to ~190px, so this stays sharp on
// high-density screens whatever the shape (they run from 2:1 wide to 1:2 tall)
const THUMB_HEIGHT = 400;
// Full size: the long edge at most this
const FULL_EDGE = 1920;

export async function getChallenge() {
  const modules = import.meta.glob<{ default: ImageMetadata }>("../assets/challenge/day_*.png", { eager: true });

  const files = Object.entries(modules).flatMap(([path, mod]) => {
    const match = path.match(/day_(\d+)(?:_(\d+))?\.png$/);
    if (!match) return [];
    // Read the size off a copy: reading it off the import makes Astro ship the original
    const info = ((mod.default as any).clone ?? mod.default) as ImageMetadata;
    return [{
      file: `day_${match[1]}${match[2] ? `_${match[2]}` : ""}`,
      day: Number(match[1]),
      part: Number(match[2] ?? 1),
      image: mod.default,
      width: info.width,
      height: info.height,
    }];
  });
  files.sort((a, b) => a.day - b.day || a.part - b.part);

  const partsPerDay = new Map<number, number>();
  for (const f of files) partsPerDay.set(f.day, (partsPerDay.get(f.day) ?? 0) + 1);

  // The gallery pieces the challenge files are linked to
  // (Loaded lazily, the same way the rest of the site loads them, so Vite doesn't warn)
  const gallery = getAllArt(
    (await Promise.all(Object.values(import.meta.glob("../assets/showcase/*.png")).map((load) => load()))) as Artworks,
  );
  const galleryById = new Map(gallery.map((art) => [art.id, art]));
  const linkMap = links as Record<string, number>;

  const pieces: ChallengePiece[] = [];
  const images: ViewerImage[] = [];

  for (const [i, f] of files.entries()) {
    const ratio = f.width / f.height;
    const parts = partsPerDay.get(f.day)!;
    const label = parts > 1 ? `Day ${f.day}, piece ${f.part} of ${parts}` : `Day ${f.day}`;

    const [thumb, full] = await Promise.all([
      getImage({ src: f.image, format: "webp", width: Math.round(THUMB_HEIGHT * ratio) }),
      getImage({
        src: f.image,
        format: "webp",
        width: ratio >= 1 ? FULL_EDGE : Math.round(FULL_EDGE * ratio),
        quality: 85,
      }),
    ]);

    const linked = galleryById.get(linkMap[f.file]);
    if (linked) {
      // The gallery version, tagged with its day
      const [entry] = await getLightboxImages([linked]);
      // Not written up in the gallery yet: go by its day instead of "Untitled"
      images.push({ ...entry, title: entry.title || label, tags: [label, ...entry.tags] });
    } else {
      images.push({
        id: 100000 + i, // clear of gallery ids; only used inside the viewer
        src: thumb.src,
        fullSrc: full.src,
        width: f.width,
        height: f.height,
        tags: ["100 days"],
        title: label,
        description: "",
        date: "",
        redrawOf: null,
        panel: null,
        page: `/100-days#day-${f.day}`,
      });
    }

    pieces.push({
      file: f.file,
      day: f.day,
      part: f.part,
      partsThatDay: parts,
      thumb: thumb.src,
      width: f.width,
      height: f.height,
      index: i,
      label: linked?.title ? `${label}: ${linked.title}` : label,
      featured: Boolean(linked),
    });
  }

  // Grouped by day, in order, for the wall
  const days = [...partsPerDay.keys()].sort((a, b) => a - b).map((day) => ({
    day,
    pieces: pieces.filter((p) => p.day === day),
  }));

  const cover = files.find((f) => f.file === "day_100")?.image;
  return { days, images, pieceCount: files.length, cover };
}
