// Puts art beside the writing. A section (a `##` heading and everything up to the next
// one) that has a line of images in it becomes text on the left, the images on the right:
//
//   <section class="art-section">
//     <div class="art-text"> heading and paragraphs </div>
//     <div class="art-stack"> <p class="art-row">images</p> <p class="art-caption">caption</p> </div>
//   </section>
//
// A line of images is a paragraph of nothing but images (each may be wrapped in a link);
// a caption is a paragraph right after it that's only *italic*.
// Sections without one are left exactly as they are. Only standalone pages
// (src/content/pages, like /process) get this; dev log posts keep their images inline.

const isElement = (node, tag) => node?.type === "element" && (!tag || node.tagName === tag);
const isBlank = (node) => node.type === "text" && !node.value.trim();
const isImage = (node) =>
  isElement(node, "img") ||
  (isElement(node, "a") && node.children.some((c) => isElement(c, "img")) && node.children.every((c) => isElement(c, "img") || isBlank(c)));

function isArtRow(node) {
  if (!isElement(node, "p")) return false;
  const parts = node.children.filter((c) => !isBlank(c));
  return parts.length >= 1 && parts.every(isImage);
}

function isCaption(node) {
  if (!isElement(node, "p")) return false;
  const parts = node.children.filter((c) => !isBlank(c));
  return parts.length === 1 && isElement(parts[0], "em");
}

const addClass = (node, name) => {
  const classes = node.properties.className ?? [];
  node.properties.className = [...classes, name];
};

const element = (tagName, className, children) => ({
  type: "element",
  tagName,
  properties: { className: [className] },
  children,
});

export default function rehypeArtSections() {
  return (tree, file) => {
    const path = (file.path ?? file.history?.[0] ?? "").replace(/\\/g, "/");
    if (!path.includes("/src/content/pages/")) return;

    // Split the page into sections, each starting at a ## heading (plus whatever comes before the first)
    const sections = [[]];
    for (const node of tree.children) {
      if (isElement(node, "h2")) sections.push([]);
      sections.at(-1).push(node);
    }

    tree.children = sections.flatMap((nodes) => {
      if (!nodes.some(isArtRow)) return nodes;

      const text = [];
      const art = [];
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!isArtRow(node)) {
          text.push(node);
          continue;
        }
        addClass(node, "art-row");
        art.push(node);
        // Its caption goes along with it (skipping the line break between them)
        let next = i + 1;
        while (next < nodes.length && isBlank(nodes[next])) next++;
        if (isCaption(nodes[next])) {
          addClass(nodes[next], "art-caption");
          art.push(nodes[next]);
          i = next;
        }
      }
      return [element("section", "art-section", [element("div", "art-text", text), element("div", "art-stack", art)])];
    });
  };
}
