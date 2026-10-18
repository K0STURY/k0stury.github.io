import { defineCollection, z } from "astro:content";

// Dev log posts: one Markdown file per post in src/content/blog/.
// Images go in a folder next to the post and are linked relatively, e.g. ./my-post/screenshot.png
const blog = defineCollection({
  type: "content",
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // One or two sentences: shown on the post's card and in link previews
      description: z.string(),
      date: z.coerce.date(),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      // The tech it's built with, shown as small tags
      tags: z.array(z.string()).default([]),
      // Where to find the project: GitHub, itch.io, a demo...
      links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
      // Drafts show up while running `npm run dev`, but never on the live site
      draft: z.boolean().default(false),
    }),
});

// Standalone written pages, one Markdown file each in src/content/pages/ (e.g. process.md
// for /process). Each needs its own route in src/pages/. Images work like the blog's.
const pages = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    // One or two sentences: shown under the title and in link previews
    description: z.string(),
  }),
});

export const collections = { blog, pages };
