import fs from "fs";
import path from "path";

const SHOWCASE_DIR = "src/assets/showcase";
const ARTWORK_JSON = "src/data/artwork.json";

const DEFAULT_ENTRY = (id) => ({
  ID: id,
  name: "",
  description: "",
  date: "",
  tag: ["Characters"],
});

// Load existing artwork.json
const existing = fs.existsSync(ARTWORK_JSON)
  ? JSON.parse(fs.readFileSync(ARTWORK_JSON, "utf-8"))
  : [];

// Index existing entries by ID
const artworkById = new Map(existing.map((a) => [a.ID, a]));


const files = fs.readdirSync(SHOWCASE_DIR);

files.forEach((file) => {
  const match = file.match(/^(\d+)-.+\.png$/i);
  if (!match) return;

  const id = Number(match[1]);
  if (!artworkById.has(id)) {
    artworkById.set(id, DEFAULT_ENTRY(id));
  }
});

// Sort by ID ascending 
const merged = [...artworkById.values()].sort((a, b) => a.ID - b.ID);

fs.writeFileSync(
  ARTWORK_JSON,
  JSON.stringify(merged, null, 2),
  "utf-8",
);

