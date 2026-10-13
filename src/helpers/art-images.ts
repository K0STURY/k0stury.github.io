import { getImage } from "astro:assets";

// The two sizes every piece is served at. Source art is ~5000x5000, far too heavy to ship.
// Everything on the site (banner, gallery tiles, lightbox) goes through here, so they all
// point at the very same files: a tile the browser already has is reused, never re-downloaded.
export const THUMB_WIDTH = 640;

export async function getArtImages(src: ImageMetadata) {
  const [thumb, full] = await Promise.all([
    getImage({ src, format: "webp", width: THUMB_WIDTH }),
    getImage({ src, format: "webp", width: 1920, quality: 85 }),
  ]);
  return { thumb: thumb.src, full: full.src };
}
