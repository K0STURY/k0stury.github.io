import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import svelte from "@astrojs/svelte";

import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  site: "https://k0stur.art",
  integrations: [tailwind(), svelte(), icon()],
  prefetch: {
    defaultStrategy: "viewport",
  },
  build: {
    format: "file"
  }
});