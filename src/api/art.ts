import { z } from "zod";

const ArtworksSchema = z.array(
  z.object({
    title: z.string(),
    id: z.number(),
    default: z.object({
      src: z.string(),
      width: z.number(),
      height: z.number(),
      format: z.string(),
    }),
  }),
);

const Artwork = ArtworksSchema.element;

export type Artworks = z.infer<typeof ArtworksSchema>;
export type Artwork = z.infer<typeof Artwork>;

export default function getAllArt(artworks: Artworks): Artworks {
  return (artworks = artworks.map((art) => {
    const src = art.default.src;
    const regex = import.meta.env.PROD
      ? /\/(\d+)-([^\/]+)\.\w+$/
      : /\/(\d+)-(.+)\.png\?/;
    const match = src.match(regex);
    let id = 0;
    let title = "";
    if (match) {
      id = Number(match[1]);
      title = import.meta.env.PROD ? match[2].replace(/\..*$/, "") : match[2];
    }

    return {
      ...art,
      id,
      title,
    };
  }));
}
