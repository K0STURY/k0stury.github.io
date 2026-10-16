// Wraps every fenced code block in dev log posts in a "slip" with a label naming its language:
//
//   <div class="code-slip"><span class="code-lang">C++</span> ...highlighted code... </div>
//
// Runs before Astro highlights the code, which (in this Astro version) drops the language.

const NAMES = {
  cpp: "C++",
  "c++": "C++",
  c: "C",
  cs: "C#",
  csharp: "C#",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  json: "JSON",
  hlsl: "HLSL",
  glsl: "GLSL",
  py: "Python",
  python: "Python",
  sh: "Shell",
  bash: "Shell",
  lua: "Lua",
  html: "HTML",
  css: "CSS",
};

const escape = (text) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export default function remarkCodeSlips() {
  return (tree) => {
    const wrap = (parent) => {
      if (!parent.children) return;
      for (let i = 0; i < parent.children.length; i++) {
        const node = parent.children[i];
        if (node.type !== "code") {
          wrap(node);
          continue;
        }
        const lang = (node.lang ?? "").toLowerCase();
        const label = lang && lang !== "plaintext" && lang !== "text" ? NAMES[lang] ?? lang : "";
        const open = `<div class="code-slip">${label ? `<span class="code-lang">${escape(label)}</span>` : ""}`;
        parent.children.splice(i, 1, { type: "html", value: open }, node, { type: "html", value: "</div>" });
        i += 2;
      }
    };
    wrap(tree);
  };
}
