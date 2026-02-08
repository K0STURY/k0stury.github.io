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
      title: meta?.name ?? "",
      description: meta?.description ?? "",
      date: meta?.date ?? "",
      tags: meta?.tag ?? ["Characters"],
    };
  });
}
