import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import svelte from "@astrojs/svelte";

import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  site: "https://k0stur.dev",
  integrations: [tailwind(), svelte(), icon()],
  image: {
    // Stock sharp, plus an on-disk cache so the dev server encodes each image only once
    service: { entrypoint: "./src/services/cached-sharp.ts" },
  },
  prefetch: {
    defaultStrategy: "viewport",
  },
  build: {
    format: "file"
  }
});