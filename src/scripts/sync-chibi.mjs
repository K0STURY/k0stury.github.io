import fs from "fs";
import path from "path";

// Keeps src/assets/chibi/positions.json in step with the part files. Run: npm run sync:chibi
// A new file starts where the lowest-numbered file in its folder sits, which is usually close.
// Entries for files that no longer exist are removed.

const CHIBI_DIR = process.argv[2] ?? "src/assets/chibi";
const POSITIONS = path.join(CHIBI_DIR, "positions.json");
const ORDER = JSON.parse(fs.readFileSync(path.join(CHIBI_DIR, "order.json"), "utf-8"));

const variantNo = (file) => Number(file.match(/_(\d+)\.png$/i)?.[1] ?? Infinity);

const existing = fs.existsSync(POSITIONS) ? JSON.parse(fs.readFileSync(POSITIONS, "utf-8")) : {};
const folders = fs
  .readdirSync(CHIBI_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

for (const folder of folders) {
  if (!ORDER.includes(folder)) console.warn(`${folder}/ isn't in order.json, so the maker won't show it yet`);
}

const merged = {};
const added = [];

// Back to front, then any folder not in the order yet
for (const folder of [...ORDER, ...folders.filter((name) => !ORDER.includes(name))]) {
  if (!folders.includes(folder)) continue;
  const files = fs
    .readdirSync(path.join(CHIBI_DIR, folder))
    .filter((file) => /\.png$/i.test(file))
    .sort((a, b) => variantNo(a) - variantNo(b));

  // Where a new file starts: its folder's first file that already has a position
  const known = files.find((file) => existing[`${folder}/${file}`]);
  const start = known ? existing[`${folder}/${known}`] : { x: 0, y: 0 };

  for (const file of files) {
    if (variantNo(file) === Infinity) console.warn(`${folder}/${file} has no _number at the end, so it runs last`);
    const key = `${folder}/${file}`;
    if (!existing[key]) added.push(key);
    merged[key] = existing[key] ?? { ...start };
  }
}

const removed = Object.keys(existing).filter((key) => !merged[key]);

const lines = Object.entries(merged).map(([key, { x, y }]) => `  ${JSON.stringify(key)}: { "x": ${x}, "y": ${y} }`);
fs.writeFileSync(POSITIONS, `{\n${lines.join(",\n")}\n}\n`, "utf-8");

added.forEach((key) => console.log(`added ${key}: ${merged[key].x}, ${merged[key].y}`));
removed.forEach((key) => console.log(`removed ${key}`));
if (!added.length && !removed.length) console.log("positions.json is already up to date");
