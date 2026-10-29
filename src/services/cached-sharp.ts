import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LocalImageService } from "astro";
import sharpService from "astro/assets/services/sharp";

// Astro's dev server re-encodes an image from its source on every single request.
// The art here is ~5000px PNGs, so each thumbnail cost ~400ms and each full-size ~630ms,
// every time. This wraps the stock sharp service and keeps the encoded result on disk,
// so in dev each variant is only ever encoded once.
//
// Dev only: `astro build` already has its own cache and goes straight through.
// Safe to delete the folder at any time; it just refills.
const CACHE_DIR = path.resolve("node_modules/.cache/art-images");

const inFlight = new Map<string, ReturnType<LocalImageService["transform"]>>();

const service: LocalImageService = {
  ...sharpService,
  // Dev image URLs are built from the file name and cached by the browser for a year, so a
  // renamed/replaced file kept showing the old picture. Stamp them with the file's version.
  getURL(options, imageConfig) {
    const url = sharpService.getURL(options, imageConfig) as string;
    if (!import.meta.env.DEV || typeof options.src !== "object") return url;
    try {
      const file = decodeURIComponent(options.src.src.replace(/^\/@fs\/?/, "").replace(/\?.*$/, ""));
      const { mtimeMs, size } = statSync(path.isAbsolute(file) ? file : `/${file}`);
      return `${url}&v=${Math.round(mtimeMs)}-${size}`;
    } catch {
      return url;
    }
  },
  async transform(inputBuffer, transformOptions, imageConfig) {
    if (!import.meta.env.DEV) {
      return sharpService.transform(inputBuffer, transformOptions, imageConfig);
    }

    // Keyed on the source bytes, so replacing a piece with a new export misses the cache
    const { src: _src, ...options } = transformOptions;
    const key = createHash("sha1")
      .update(inputBuffer)
      .update(JSON.stringify(options))
      .digest("hex");

    const running = inFlight.get(key);
    if (running) return running;

    const job = (async () => {
      const file = path.join(CACHE_DIR, key);
      const meta = `${file}.format`;

      try {
        const [data, format] = await Promise.all([readFile(file), readFile(meta, "utf8")]);
        return { data, format } as Awaited<ReturnType<LocalImageService["transform"]>>;
      } catch {
        // Not cached yet
      }

      const result = await sharpService.transform(inputBuffer, transformOptions, imageConfig);

      try {
        await mkdir(CACHE_DIR, { recursive: true });
        // Write to a temp name first so a half-written file is never read back
        const tmp = `${file}.${process.pid}.tmp`;
        await writeFile(tmp, result.data);
        await rename(tmp, file);
        await writeFile(meta, result.format);
      } catch {
        // Caching is best-effort; the image itself is fine
      }

      return result;
    })();

    inFlight.set(key, job);
    try {
      return await job;
    } finally {
      inFlight.delete(key);
    }
  },
};

export default service;
