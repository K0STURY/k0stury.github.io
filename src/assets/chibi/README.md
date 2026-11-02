# Chibi Quil maker parts

Each folder is one part. Each PNG in it is a choice for that part, on `/workshop`.

## Adding or updating parts

1. Export everything to `chibi-inbox/` in the project's root, as `Name_number.png`, like
   `Horns_3.png`. The number sets its place in the arrows, and `_1` is the default look. Use a
   transparent background.
2. Run `npm run sync:chibi`. It moves each file to its part's folder and adds new ones to
   `positions.json`, starting where the folder's first file sits. Exporting a file that's
   already there replaces it and keeps its position.
3. Check it on `/workshop`, and nudge its `x` and `y` in `positions.json` if needed. The script
   warns when a replacement changed size, as that can move it.

A file goes where its name already lives: `Back_3` joins `Back_1` in `hair-back/`. A part named
in `order.json` needs no earlier file: `Mouth_1` goes to `mouth/`. Any other name stays in the
inbox with a warning. Move that first one into its folder by hand, and the name is known from then on.

## Positions

`positions.json` says where each file's **centre** sits, measured from the **centre of the
5000×5000 canvas**:

- `x`: negative is left, positive is right.
- `y`: negative is up, positive is down.
- `{ "x": 0, "y": 0 }` is dead centre, so a full-canvas 5000×5000 export needs exactly that.

A file with no entry is centred too.

To copy a position out of Affinity, take the layer's centre and subtract 2500 from each of
`x` and `y`. Quil has moved a little from the Affinity layout (head parts down 80, body up
120, to close the neck gap), so a cropped part needs that added: +80 to `y` for head parts,
-120 for body parts.

## Animal ears

`animal-ears/` is for ears that sit on top of the head, like `Animal_1.png`. They're in front of
the hair, start switched off and take the Hair colour. Ears on the side of the head go in `ears/`
and take the Skin colour.

## Face accessories

Glasses and such go in `face-accessories/`, like `Glasses_1.png`. They sit on top of the eyes,
start switched off, and get their own Accessories colour chip. Transparent lenses stay
transparent. To put something under the eyes instead, move `face-accessories` in `order.json`.

Visitors can move, resize and tilt them in the maker's Advanced section. To give another part
those controls, add its folder name to `ADJUSTABLE` in `src/pages/workshop.astro`.

## Adding a whole new part

1. Make a folder for it and add the folder name to `order.json`. That list is the layer
   order, back to front.
2. Add its files as above.

It then rides along with the head when Quil bobs, and draws in its own colours. These all
live near the top of `src/pages/workshop.astro` or in its styles:

- `COLORS`: which colour chip recolours it.
- `OPTIONAL`: lets it be taken off.
- `isPlanted`: keeps it still with the body instead of the head.
- `canvas[data-part="..."]`: gives it its own follow-through movement.

## Recolouring

A part's main colour is treated as the colour to replace, and shading is kept. Anything much
brighter than the main colour stays as drawn, like the hoodie's drawstrings. One recolourable
layer gets one colour, so two colours on one piece need two layers.
