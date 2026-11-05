# Daily Venn (prototype)

A daily Venn diagram puzzle. Two circles overlap; the overlap names the connection
and a clue (usually a number) sits above each blank. Players get 5 guesses to fill
both circles. Answers stay in place once found.

Plain HTML, CSS and JavaScript. No build step.

## Adding a puzzle

Edit `js/puzzles.js` and add an entry to `VENN_PUZZLES`. The comments at the top of
that file explain every field. The game shows the puzzle dated today (player's
local time); if there isn't one, it keeps showing the latest earlier puzzle.

Formats:

- **classic**: guess what's in each circle (the first puzzle).
- **reverse**: the circles are filled in; the player guesses the connection. Use
  `keywords` so reasonable phrasings are accepted.
- **mega**: three circles with answers in any region.

## Testing

- `?d=2026-11-05` previews the puzzle for that date (nothing is saved).
- `?sample=reverse` and `?sample=mega` open the example puzzles for those formats.

To run locally: `python3 -m http.server` in this folder, then open http://localhost:8000.

## Player data

Stats, streak and today's progress are kept in the browser's `localStorage`. The
stats screen has a "Move your streak to another device" option that copies a code
the player can paste on another device.

## Later

- `VENN_SITE.kofiUrl` in `js/puzzles.js` shows a "Buy me a coffee" link when set.
- `VENN_SITE.footerSponsor`, or `sponsor` on an individual puzzle, shows a
  "supported by" line.
- Graphics: the circles are drawn in `js/app.js` (`LAYOUTS`) and coloured in
  `css/style.css` (`--c0`, `--c1`, `--c2`). Swap these for your own artwork.

## Publishing on GitHub Pages

Repository Settings → Pages → Build and deployment → Source: "Deploy from a branch",
then pick the branch and `/ (root)`.
