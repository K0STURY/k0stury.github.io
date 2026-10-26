import { z } from "zod";
import artworkMeta from "@data/artwork.json";
import { quirkShapes } from "src/helpers/quirks";

const ArtworkMetaSchema = z.object({
  ID: z.number(),
  name: z.string(),
  description: z.string(),
  date: z.string(),
  tag: z.array(z.string()),
  // ID of the older piece this one redraws. Blank (null or "") means it isn't a redraw.
  redrawOf: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value == null || String(value).trim() === "") return null;
      const id = Number(value);
      return Number.isInteger(id) ? id : null;
    }),
  // Hover extras for the piece's tile ("horns", "ears", ...). Each name is a folder
  // of shapes in src/assets/quirks.
  quirks: z.array(z.string()).optional(),
});

// The quirks there are shapes for: one folder each in src/assets/quirks
const knownQuirks = new Set(Object.keys(quirkShapes));

const ArtworksMetaSchema = z.array(ArtworkMetaSchema);

type ArtworkMeta = z.infer<typeof ArtworkMetaSchema>;

const ArtworksSchema = z.array(
  z.object({
    default: z.object({
      src: z.string(),
      width: z.number(),
      height: z.number(),
      format: z.string(),
    }),
  }),
);

const ArtworkSchema = ArtworksSchema.element;

export type Artworks = z.infer<typeof ArtworksSchema>;
export type Artwork = z.infer<typeof ArtworkSchema> & {
  id: number;
  // The source image's size. Read these, never art.default.width/height (see getAllArt)
  width: number;
  height: number;
  title: string;
  description: string;
  date: string;
  tags: string[];
  redrawOf: number | null;
  quirks: string[];
};

const parsedMeta = ArtworksMetaSchema.parse(artworkMeta);

// Pieces that haven't been written up yet carry these stand-ins in artwork.json.
// They count as empty, so the site shows "Untitled" and no description for them;
// replacing the text in the data file is all it takes for a piece to get its own.
const PLACEHOLDER_TITLE = "Coming Soon";
const PLACEHOLDER_DESCRIPTION = "In progress";

function realText(value: string | undefined, placeholder: string) {
  const text = value?.trim() ?? "";
  return text.toLowerCase() === placeholder.toLowerCase() ? "" : text;
}

const metaById = new Map<number, ArtworkMeta>(
  parsedMeta.map((entry) => [entry.ID, entry]),
);


// getAllArt runs once per page, so only say each problem once per build
const warned = new Set<string>();

function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[artwork.json] ${message}`);
}

export default function getAllArt(artworks: Artworks): Artwork[] {
  const arts = artworks.map((art) => {
    // Read the image's details off a copy. Reading any of them off the import itself
    // tells Astro the full-size original is used on the page, so it ships all of them
    // (~9MB each) with the site. Passing art.default to getImage is fine: it copies too.
    const image: { src: string; width: number; height: number } =
      (art.default as any).clone ?? art.default;
    const src = image.src;

    const regex = import.meta.env.PROD
      ? /\/(\d+)-[^\/]+\.\w+$/
      : /\/(\d+)-.+\.png\?/;

    const match = src.match(regex);
    const id = match ? Number(match[1]) : 0;

    const meta = metaById.get(id);

    return {
      ...art,
      id,
      width: image.width,
      height: image.height,
      title: realText(meta?.name, PLACEHOLDER_TITLE),
      description: realText(meta?.description, PLACEHOLDER_DESCRIPTION),
      date: meta?.date ?? "",
      tags: meta?.tag ?? ["Characters"],
      redrawOf: meta?.redrawOf ?? null,
      quirks: meta?.quirks ?? [],
    };
  });

  // A quirk only counts if there are shapes for it
  for (const art of arts) {
    const unknown = art.quirks.filter((quirk) => !knownQuirks.has(quirk));
    if (unknown.length === 0) continue;
    for (const quirk of unknown) {
      warnOnce(`piece ${art.id} has quirk "${quirk}", but there's no src/assets/quirks/${quirk} folder; ignoring it`);
    }
    art.quirks = art.quirks.filter((quirk) => knownQuirks.has(quirk));
  }

  // A redraw link only counts if it points at another piece that's actually on the site
  const ids = new Set(arts.map((art) => art.id));
  for (const art of arts) {
    if (art.redrawOf == null) continue;
    if (art.redrawOf === art.id) {
      warnOnce(`piece ${art.id} is marked as a redraw of itself; ignoring it`);
      art.redrawOf = null;
    } else if (!ids.has(art.redrawOf)) {
      warnOnce(`piece ${art.id} is a redraw of ${art.redrawOf}, but there's no piece ${art.redrawOf}; ignoring it`);
      art.redrawOf = null;
    }
  }

  return arts;
}
