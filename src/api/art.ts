import { z } from "zod";
import artworkMeta from "@data/artwork.json";

const ArtworkMetaSchema = z.object({
  ID: z.number(),
  name: z.string(),
  description: z.string(),
  date: z.string(),
  tag: z.array(z.string()),
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


export default function getAllArt(artworks: Artworks): Artwork[] {
  return artworks.map((art) => {
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
    };
  });
}
