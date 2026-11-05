// =====================================================================
//  PUZZLES — this is the only file you need to edit each day.
// =====================================================================
//
// Add one object per day to VENN_PUZZLES. The game shows the puzzle whose
// date matches today (the player's local date). If there's no puzzle for
// today it shows the most recent one before today.
//
// Regions
//   Two circles:   A (left only), B (right only), AB (the overlap)
//   Three circles: A (top), B (bottom left), C (bottom right),
//                  AB, AC, BC, ABC (centre)
//
// Each region is either:
//   { text: "Shown from the start" }
//   { slot: { hint: "#3", answer: "India", accept: ["india", "republic of india"] } }
// A slot is something the player has to guess. `hint` sits above it
// (usually a number). `accept` lists every answer you'll take — spelling,
// capitals and accents don't matter. For looser answers (reverse days) use
// `keywords`: a list of word groups, and a guess counts if it contains every
// word in any one group, e.g. [["no", "moon"], ["moonless"]].
//
// Other fields
//   type:        "classic" | "reverse" | "mega" (only changes the label)
//   circles:     2 or 3 entries; `label` is optional text beside each circle
//   maxGuesses:  defaults to 5
//   suggest:     "countries" turns on country autocomplete, and a guess that
//                isn't a country doesn't use up a turn
//   instruction: one line shown above the diagram
//   note:        your personal note, shown when the round ends
//   source:      where the data came from (shown with the note)
//   sponsor:     optional { name, url } shown under the puzzle
// =====================================================================

window.VENN_SITE = {
  name: "Daily Venn",
  // Set these later. Nothing is shown while they're empty.
  kofiUrl: "",
  footerSponsor: null // e.g. { name: "Some Charity", url: "https://..." }
};

window.VENN_PUZZLES = [
  {
    date: "2026-11-05",
    type: "classic",
    instruction: "Name the country in each circle.",
    suggest: "countries",
    circles: [{}, {}],
    regions: {
      A:  { slot: { hint: "#3",  answer: "India",  accept: ["india"] } },
      B:  { slot: { hint: "#22", answer: "Sweden", accept: ["sweden"] } },
      AB: { text: "Cardamom imports by country, 2019" }
    },
    note: "Write a line or two here about why you picked today's puzzle.",
    source: "Ranking of countries by cardamom imports, 2019."
  }
];

// Example puzzles for the other formats. These never appear as the daily
// puzzle; open them with ?sample=reverse or ?sample=mega on the end of the URL.
window.VENN_SAMPLES = {
  reverse: {
    date: "sample-reverse",
    type: "reverse",
    instruction: "What connects the two circles?",
    circles: [{}, {}],
    regions: {
      A:  { text: "Mercury", hint: "1st" },
      B:  { text: "Venus", hint: "2nd" },
      AB: { slot: {
        hint: "?",
        answer: "Planets with no moons",
        accept: ["moonless planets"],
        keywords: [["no", "moon"], ["moonless"], ["without", "moon"], ["zero", "moon"]]
      } }
    },
    note: "Reverse days: the answers are given and you guess the connection.",
    source: "Sample puzzle."
  },
  mega: {
    date: "sample-mega",
    type: "mega",
    instruction: "Fill in the overlaps.",
    maxGuesses: 6,
    circles: [{ label: "Planets" }, { label: "Roman gods" }, { label: "Chocolate bars" }],
    regions: {
      AB:  { slot: { hint: "Biggest", answer: "Jupiter", accept: ["jupiter"] } },
      ABC: { slot: { hint: "4th", answer: "Mars", accept: ["mars"] } },
      C:   { slot: { hint: "Spiral", answer: "Galaxy", accept: ["galaxy"] } }
    },
    note: "Mega days: three circles, more to find.",
    source: "Sample puzzle."
  }
};
