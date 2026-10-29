# Desk mascot

Drop one image in this folder and it shows up on every page, popping up from the
bottom edge of the screen (just left of the back-to-top button). Leave the folder
without an image and the mascot simply isn't there.

- **File:** any name, `.png`, `.webp` or `.svg` (if there are several, the first
  alphabetically is used, so you can keep old versions as e.g. `z-old.png`).
- **Shape:** a character with a **transparent background**, facing the viewer.
  Let the art touch the **bottom** of the canvas: it rises out of the screen edge.
  The top half (head, hands) is what peeks out.
- **Size:** about 600–1000px is plenty; it's shown at roughly 160px wide.
- It gets a paper sticker outline automatically, so dark clothes still read.

It ducks when you scroll fast, rises on hover, and says one of
the desk-note quotes (src/data/quotes.json) when clicked.

## Animation frames

- **zzz/**: asleep, the default loop (character and Z's).
- **pop_up/**: plays once when you hover it while it's asleep, as it rises; then it
  goes back to sleeping until clicked.
- **click/**: plays once when it's clicked: it wakes up.
- **idle/**: awake; loops while you keep hovering after a click. A second after the
  pointer leaves it falls back asleep. Also the about-section avatar's loop.
- Name them like the art, index first: `1_idle.png`, `2_idle.png`, ... `1_click.png`, ...
  They play in index order. Use the same canvas size for every frame.
- Until `zzz/` or `idle/` has frames, the single image above stands in (still). An empty
  `click/` just means no click animation.
- **timing.json** in a folder: how long each frame shows, in ms, in frame order, e.g.
  `[75, 75, 200, 75]` holds frame 3 longer. Frames it doesn't cover (or no file) use
  150ms (75ms for click).
- Missing zzz or idle frames: the other one is used for both.
