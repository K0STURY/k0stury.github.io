import { getCollection, type CollectionEntry } from "astro:content";
import { blogLive } from "src/site.config";

export type Post = CollectionEntry<"blog">;

// Whether the dev log is built at all: always in `npm run dev`, on the live site only once blogLive is on
export const blogEnabled = import.meta.env.DEV || blogLive;

// Newest first. Drafts only show while running the dev server, never on the live site.
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection("blog", (post) => import.meta.env.DEV || !post.data.draft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

// Reading time from the prose; code is skimmed rather than read, so it doesn't count
export function readingMinutes(post: Post) {
  const words = post.body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

// Posts are dated to the month: "March 2026"
export function formatPostDate(date: Date) {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
