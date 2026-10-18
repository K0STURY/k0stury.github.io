# Gallery quirks

Shapes that pop out of stickers on hover, in the gallery and on the banner. **Every folder here is a quirk**, named after the folder. A piece gets one by listing it in `src/data/artwork.json`:

```json
"quirks": [
  "ears",
  "witch-hats"
]
```

Each folder is a pool: every hover picks a random file from it. Add, remove or replace files freely; any `.svg` in a folder is picked up on the next build. A name with no folder behind it is ignored, with a warning in the build output.

Only the **shape** of each SVG is used: it's filled with the frame's white, so colours, gradients and strokes in the file don't matter (anything not transparent counts).

## Pairs: `horns/`, `ears/`

A pair rises from behind the top of the frame, either side of the pin.

- Draw the **left** piece, base at the bottom edge of the canvas. The right one is the same file mirrored.
- The bottom of the canvas sits hidden behind the frame (~30% for horns, ~20% for ears).
- Horns fit into a 3:4 box (24×32), ears into a square (32×32), anchored bottom-centre. Other proportions work, they just get scaled down to fit.

## Corner: `witch-hats/`

One piece dropped onto the frame's top-right corner. Brim at the bottom of the canvas; fit into a 6:5 box (48×40).

## Adding a new quirk

1. Make a folder here and put SVGs in it. The folder name is the quirk's name.
2. List that name in pieces' `quirks`.

It's a pair by default. To make it a corner piece instead, add its name to `CORNER_QUIRKS` in `src/helpers/quirks.ts`. A tile shows at most one pair and one corner piece, the first of each in its list.
