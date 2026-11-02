import fs from "fs";
import path from "path";

// Files new exports from chibi-inbox/ into their part folders, then keeps
// src/assets/chibi/positions.json in step with the part files. Run: npm run sync:chibi
// A new file starts where the lowest-numbered file in its folder sits, which is usually close.
// Entries for files that no longer exist are removed.

const CHIBI_DIR = process.argv[2] ?? "src/assets/chibi";
const INBOX = process.argv[3] ?? "chibi-inbox";
const POSITIONS = path.join(CHIBI_DIR, "positions.json");
const ORDER = JSON.parse(fs.readFileSync(path.join(CHIBI_DIR, "order.json"), "utf-8"));

const variantNo = (file) => Number(file.match(/_(\d+)\.png$/i)?.[1] ?? Infinity);
const isPng = (file) => /\.png$/i.test(file);
const pngSize = (file) => {
  const header = fs.readFileSync(file);
  return `${header.readUInt32BE(16)}x${header.readUInt32BE(20)}`;
};

// A file goes wherever files of its name already live (Back_3 joins Back_1 in hair-back), or to
// the part it's named after (Mouth_1 to mouth). Anything else stays put to be filed by hand once:
// after that, its name is known.
function sortInbox() {
  fs.mkdirSync(INBOX, { recursive: true });
  const nameOf = (file) => file.replace(/(_\d+)?\.png$/i, "").toLowerCase();
  const folderFor = new Map(ORDER.map((part) => [part.toLowerCase(), part]));
  for (const entry of fs.readdirSync(CHIBI_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    folderFor.set(entry.name.toLowerCase(), entry.name);
    for (const file of fs.readdirSync(path.join(CHIBI_DIR, entry.name)).filter(isPng)) folderFor.set(nameOf(file), entry.name);
  }

  for (const exported of fs.readdirSync(INBOX).filter(isPng)) {
    const file = exported.trim(); // Affinity can put a space on the front of a slice's name
    const name = nameOf(file);
    const folder = folderFor.get(name) ?? folderFor.get(name.replace(/s$/, "")) ?? folderFor.get(`${name}s`);
    if (!folder) {
      console.warn(`${file} stays in ${INBOX}: nothing goes by that name yet, so put this one in its part folder yourself`);
      continue;
    }
    const dir = path.join(CHIBI_DIR, folder);
    fs.mkdirSync(dir, { recursive: true });
    // Keeps the spelling already there, so that a replacement holds on to its position
    const target = fs.readdirSync(dir).find((other) => other.toLowerCase() === file.toLowerCase()) ?? file;
    const from = path.join(INBOX, exported);
    const to = path.join(dir, target);
    const oldSize = fs.existsSync(to) ? pngSize(to) : null;
    const newSize = pngSize(from);
    fs.renameSync(from, to);
    console.log(`${oldSize ? "replaced" : "filed"} ${folder}/${target}`);
    // A position is measured to the file's centre, and resizing a crop moves its centre
    if (oldSize && oldSize !== newSize) console.warn(`  its size changed (${oldSize} to ${newSize}): check where it sits on /workshop`);
  }
}

sortInbox();

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
