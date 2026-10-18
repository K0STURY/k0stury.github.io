import type { Artwork } from "@api/art";
import { getArtImages } from "./art-images";
import { getArtPanel } from "./art-panel";

// What the lightbox (src/components/lightbox.svelte) needs for each piece it can show.
// Thumbnail for the tile + capped full-res webp for the lightbox.
// The lightbox shows the tile's own thumbnail (already downloaded) until the full-res arrives.
export async function getLightboxImages(arts: Artwork[]) {
  // Pieces in a redraw pair (either half): the then & now view lines these up
  const paired = new Set(arts.flatMap((art) => (art.redrawOf == null ? [] : [art.id, art.redrawOf])));

  return Promise.all(
    arts.map(async (art) => {
      const { thumb, full } = await getArtImages(art.default as any);
      const panel = paired.has(art.id) ? await getArtPanel(art.id) : null;
      return {
        id: art.id,
        src: thumb,
        fullSrc: full,
        width: art.default.width,
        height: art.default.height,
        tags: art.tags,
        title: art.title,
        description: art.description,
        date: art.date,
        redrawOf: art.redrawOf,
        panel,
      };
    }),
  );
}
