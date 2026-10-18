// Marks caption lines: a paragraph that's nothing but *italic* or **bold** text (like
// "*Code Example*" above a snippet, or a line under some images) gets class="caption".
// CSS alone can't tell that apart from a sentence with one bold word in it.

const isBlank = (node) => node.type === "text" && !node.value.trim();
const isEmphasis = (node) => node.type === "element" && (node.tagName === "em" || node.tagName === "strong");

export default function rehypeCaptions() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === "element" && node.tagName === "p") {
        const parts = node.children.filter((c) => !isBlank(c));
        if (parts.length === 1 && isEmphasis(parts[0])) {
          node.properties.className = [...(node.properties.className ?? []), "caption"];
        }
        return;
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
