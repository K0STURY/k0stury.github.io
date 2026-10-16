import { z } from "zod";
import artworkMeta from "@data/artwork.json";

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
});

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
  title: string;
  description: string;
  date: string;
  tags: string[];
  redrawOf: number | null;
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
    const src = art.default.src;

    const regex = import.meta.env.PROD
      ? /\/(\d+)-[^\/]+\.\w+$/
      : /\/(\d+)-.+\.png\?/;

    const match = src.match(regex);
    const id = match ? Number(match[1]) : 0;

    const meta = metaById.get(id);

    return {
      ...art,
      id,
      title: realText(meta?.name, PLACEHOLDER_TITLE),
      description: realText(meta?.description, PLACEHOLDER_DESCRIPTION),
      date: meta?.date ?? "",
      tags: meta?.tag ?? ["Characters"],
      redrawOf: meta?.redrawOf ?? null,
    };
  });

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
