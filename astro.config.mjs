import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import svelte from "@astrojs/svelte";

import icon from "astro-icon";
import remarkCodeSlips from "./src/plugins/remark-code-slips.mjs";

// https://astro.build/config
export default defineConfig({
  site: "https://k0stur.dev",
  integrations: [tailwind(), svelte(), icon()],
  image: {
    // Stock sharp, plus an on-disk cache so the dev server encodes each image only once
    service: { entrypoint: "./src/services/cached-sharp.ts" },
  },
  markdown: {
    // Code colours in dev log posts: a muted dark theme that sits on the dark code slips
    shikiConfig: { theme: "vitesse-dark" },
    // Each code block becomes a "slip" labelled with its language (see the plugin)
    remarkPlugins: [remarkCodeSlips],
  },
  prefetch: {
    defaultStrategy: "viewport",
  },
  build: {
    format: "file"
  },
  vite: {
    // sharp is a native, server-only module (src/helpers/art-panel.ts): never try to bundle it
    optimizeDeps: { exclude: ["sharp"] },
    ssr: { external: ["sharp"] },
  },
});