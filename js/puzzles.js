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
//   maxGuesses:  number of turns, defaults to 5. Each turn the player
//                guesses every circle that's still blank
//   suggest:     "countries" turns on country autocomplete, and a guess that
//                isn't a country doesn't use up a turn
//   instruction: one line shown above the diagram
//   note:        the setter's story, shown when the round ends
//   source:      where the data came from (shown with the note)
//   sourceUrl:   optional link for the source
//   sources:     several links instead: [{ name: "UK", url: "https://..." }, ...]
//
// Number answers (good for reverse days): give the slot input: "number" and
// it takes "10", "10th", "ten" or "tenth" alike, and refuses non-numbers
// without using a turn. Add template: "The ___th biggest cities…" to show the
// connection as a sentence with the answer in the gap.
//   sponsor:     optional { name, url } shown under the puzzle
// =====================================================================

window.VENN_SITE = {
  name: "On The Venns",
  maker: { name: "Bass Moultapps", logo: "img/bass-moultapps.jpg" },
  // Hand-drawn title, Venn and guess boxes (img/drawn/). Set to false to go
  // back to the plain drawn-by-code look. ?drawn=0 in the URL also switches it off.
  drawn: true,
  // Circle colours. Each puzzle takes the next set in this list (left, right,
  // and a third for mega days), then it starts again from the top.
  // A puzzle can also pick its own with colours: ["#D30C7B", "#38618C"].
  //   Hot Rose #D30C7B · Dark Khaki #5C573E · Pumpkin Spice #FA7921
  //   Dry Sage #A2AD91 · Baltic Blue #38618C
  colourSets: [
    ["#38618C", "#FA7921", "#A2AD91"], // Baltic Blue + Pumpkin Spice
    ["#D30C7B", "#A2AD91", "#5C573E"], // Hot Rose + Dry Sage
    ["#FA7921", "#5C573E", "#38618C"], // Pumpkin Spice + Dark Khaki
    ["#38618C", "#D30C7B", "#FA7921"], // Baltic Blue + Hot Rose
    ["#A2AD91", "#FA7921", "#D30C7B"]  // Dry Sage + Pumpkin Spice
  ],
  // Set these later. Nothing is shown while they're empty.
  kofiUrl: "",
  footerSponsor: null // e.g. { name: "Some Charity", url: "https://..." }
};

window.VENN_PUZZLES = [
  {
    date: "2026-11-05",
    type: "classic",
    instruction: "Name the country in each circle.",
    // colours: ["#D30C7B", "#38618C"], // optional: override the rotation
    suggest: "countries",
    circles: [{}, {}],
    regions: {
      A:  { slot: { hint: "#3",  answer: "India",  accept: ["india"] } },
      B:  { slot: { hint: "#22", answer: "Sweden", accept: ["sweden"] } },
      AB: { text: "Cardamom imports by country, 2019" }
    },
    note: "I was just thinking how much I liked cardamom, having enjoyed a sweet Diwali treat from a colleague. It took me back to a trip to Stockholm and the continual hankering for a cardamom or cinnamon bun. And, in my brain, that's how this whole Venn thing came about.",
    source: "Ranking of countries by cardamom imports, 2019."
  },
  {
    date: "2026-11-06",
    type: "classic",
    instruction: "Name the letter in each circle.",
    circles: [{}, {}],
    regions: {
      A:  { slot: { hint: "4th", answer: "O", accept: ["o", "letter o", "the letter o"] } },
      B:  { slot: { hint: "6th", answer: "N", accept: ["n", "letter n", "the letter n"] } },
      AB: { text: "Most commonly used letters in English language text" }
    },
    note: "I was thinking earlier that you don't see a lot of 'U's lurking around. I don't know why I was thinking this, but 'U' doesn't even appear in the top ten. I admire whoever did the maths to work this out, and look forward to struggling with having 2 'U's in Scrabble (not to be confused with U2 in Scrabble, a scene from some sort of teatime fever dream).",
    source: "Cornell Math Cryptography Guide",
    sourceUrl: "https://pi.math.cornell.edu/~mec/2003-2004/cryptography/subs/frequencies.html"
  },
  {
    date: "2026-11-10",
    type: "reverse",
    instruction: "What links the two cities? Fill in the number.",
    circles: [{}, {}],
    regions: {
      A:  { text: "Bristol", hint: "United Kingdom" },
      B:  { text: "Bremen", hint: "Germany" },
      AB: { slot: {
        hint: "#",
        input: "number",
        answer: "10",
        template: "The ___th biggest cities by population in their respective countries"
      } }
    },
    note: "'I\u2019ve been to Bristol, but I\u2019ve never been to Bremen' sounds like a rejected lyric for a Tinie Tempah banger, but today I was just interested in sizes of cities for no real reason, and the B & B beginnings of these two in the United Kingdom and Germany caught my eye.",
    source: "National data collated by Worldometers",
    sources: [
      { name: "UK", url: "https://www.worldometers.info/population/largest-cities-in-uk/" },
      { name: "Germany", url: "https://www.worldometers.info/population/largest-cities-in-germany/" }
    ]
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
