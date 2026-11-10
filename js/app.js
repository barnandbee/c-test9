(function () {
  "use strict";

  var SITE = window.VENN_SITE || {};
  var NAME = SITE.name || "On The Venns";
  var PUZZLES = (window.VENN_PUZZLES || []).slice().sort(function (a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
  var SAMPLES = window.VENN_SAMPLES || {};
  var STORE_KEY = "dailyvenn.v1"; // kept from the first prototype so existing streaks carry over

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }

  function localDate(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function norm(s) {
    return String(s)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^the /, "");
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var toastTimer;
  function toast(msg, ms) {
    var t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 1800);
  }

  // ---------- countries ----------
  var COUNTRY_CANON = {}; // normalised -> normalised canonical name
  (window.VENN_COUNTRIES || []).forEach(function (c) { COUNTRY_CANON[norm(c)] = norm(c); });
  var aliases = window.VENN_COUNTRY_ALIASES || {};
  Object.keys(aliases).forEach(function (k) { COUNTRY_CANON[norm(k)] = norm(aliases[k]); });

  // ---------- pick today's puzzle ----------
  var params = new URLSearchParams(location.search);
  var today = localDate();
  var puzzle, index, preview = false, past = false, previewReason = "";
  // today's live puzzle: the latest one dated today or earlier
  var liveIndex = 0;
  PUZZLES.forEach(function (p, i) { if (p.date <= today) liveIndex = i; });

  var DRAWN = SITE.drawn !== false && params.get("drawn") !== "0";
  document.documentElement.classList.toggle("drawn", DRAWN);

  var sampleKey = params.get("sample");
  if (sampleKey && SAMPLES[sampleKey]) {
    puzzle = SAMPLES[sampleKey];
    index = -1;
    preview = true;
    previewReason = "Sample " + sampleKey + " puzzle. Nothing is saved.";
  } else {
    var target = params.get("d") || today;
    index = -1;
    PUZZLES.forEach(function (p, i) { if (p.date <= target) index = i; });
    if (index < 0) index = 0; // before launch: show the first puzzle
    puzzle = PUZZLES[index];
    if (params.get("d") && puzzle) {
      if (index < liveIndex) {
        // Venns of the Past: playable for fun, saved separately, never counted
        past = true;
      } else if (index > liveIndex) {
        preview = true;
        previewReason = "Previewing the puzzle for " + puzzle.date + ". Nothing is saved.";
      }
    }
  }

  if (!puzzle) {
    $("instruction").textContent = "No puzzle yet. Add one in js/puzzles.js.";
    return;
  }

  // Circle colours rotate through VENN_SITE.colourSets, one set per puzzle,
  // unless the puzzle sets its own `colours`.
  var colourSets = SITE.colourSets && SITE.colourSets.length ? SITE.colourSets : [["#e8735a", "#3a9e9a", "#e2b23c"]];
  function coloursFor(p, i) { return p.colours || colourSets[i % colourSets.length]; }
  var colours = coloursFor(puzzle, index >= 0 ? index : (sampleKey || "").length);
  colours.forEach(function (c, i) { document.documentElement.style.setProperty("--c" + i, c); });

  var maxTurns = puzzle.maxGuesses || 5;
  var nCircles = puzzle.circles && puzzle.circles.length === 3 ? 3 : 2;
  var useCountries = puzzle.suggest === "countries";

  var slots = [];
  Object.keys(puzzle.regions).forEach(function (key) {
    var r = puzzle.regions[key];
    if (r.slot) slots.push(Object.assign({ id: key }, r.slot));
  });

  // Number answers (input: "number"): "10", "10th", "ten" and "tenth" all read as 10.
  var NUM_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
  var ORD_WORDS = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
    "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth"];
  function toNumber(s) {
    var n = norm(s).replace(/^(no|number|the)\s+/, "");
    var m = n.match(/^(\d+)\s*(st|nd|rd|th)?$/);
    if (m) return parseInt(m[1], 10);
    var i = NUM_WORDS.indexOf(n);
    if (i < 0) i = ORD_WORDS.indexOf(n);
    return i < 0 ? null : i;
  }
  function isNumberSlot(slot) { return slot && slot.input === "number"; }

  function canon(s, slot) {
    if (isNumberSlot(slot)) { var num = toNumber(s); return num === null ? norm(s) : "#" + num; }
    var n = norm(s);
    return useCountries && COUNTRY_CANON[n] ? COUNTRY_CANON[n] : n;
  }

  function matches(slot, guess) {
    var g = canon(guess, slot);
    var accepted = (slot.accept && slot.accept.length ? slot.accept : [slot.answer]).concat([slot.answer]);
    if (accepted.some(function (a) { return canon(a, slot) === g; })) return true;
    if (slot.keywords) {
      var padded = " " + g + " ";
      return slot.keywords.some(function (group) {
        return group.every(function (w) {
          w = norm(w);
          // match whole words, allowing a plural "s"
          return padded.indexOf(" " + w + " ") >= 0 || padded.indexOf(" " + w + "s ") >= 0 || (w.length > 4 && g.indexOf(w) >= 0);
        });
      });
    }
    return false;
  }

  // green: right answer in this circle; blue: belongs in another circle; red: neither
  function judge(slot, text) {
    if (matches(slot, text)) return "green";
    if (slots.some(function (o) { return o.id !== slot.id && matches(o, text); })) return "blue";
    return "red";
  }

  // What to call each circle/region, and which circle colours it sits in.
  var POS_NAMES = {
    2: { A: "Left circle", B: "Right circle", AB: "Middle" },
    3: { A: "Top circle", B: "Bottom left", C: "Bottom right", AB: "Top-left overlap", AC: "Top-right overlap", BC: "Bottom overlap", ABC: "Centre" }
  };
  function slotName(id) {
    var labels = (puzzle.circles || []).map(function (c) { return c && c.label; });
    if (nCircles === 3 && labels.every(Boolean)) {
      var parts = id.split("").map(function (l) { return labels["ABC".indexOf(l)]; });
      return parts.length === 1 ? parts[0] + " only" : parts.join(" + ");
    }
    return POS_NAMES[nCircles][id] || id;
  }
  function slotSwatch(id) {
    var cols = id.split("").map(function (l) {
      var c = "var(--c" + "ABC".indexOf(l) + ")";
      return DRAWN ? "color-mix(in srgb, " + c + " 45%, transparent)" : c;
    });
    if (cols.length === 1) cols.push(cols[0]);
    return "linear-gradient(90deg," + cols.join(",") + ")";
  }

  // ---------- storage ----------
  function defaultStore() {
    return {
      stats: { played: 0, wins: 0, streak: 0, maxStreak: 0, lastWinIndex: null, lastWinDate: null },
      games: {},    // daily puzzles, played on the day: these count
      practice: {}, // Venns of the Past played later, just for fun
      awards: {},   // rosettes: id -> time unlocked
      unseen: [],   // rosettes unlocked since the stats were last opened
      profile: { name: "", avatar: 1 },
      flags: {},    // one-off actions, e.g. vPressed
      avatarsKnown: [1], // avatars the player has already been told about
      seenHelp: false
    };
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        var d = defaultStore();
        return {
          stats: Object.assign(d.stats, s.stats || {}),
          games: s.games || {},
          practice: s.practice || {},
          awards: s.awards || {},
          profile: Object.assign({ name: "", avatar: 1 }, s.profile || {}),
          flags: s.flags || {},
          avatarsKnown: s.avatarsKnown || [1],
          unseen: s.unseen || [],
          seenHelp: !!s.seenHelp
        };
      }
    } catch (e) { /* storage blocked or corrupt */ }
    return defaultStore();
  }

  var store = loadStore();

  // A saved game belongs to the puzzle it was played on. If a puzzle is moved to
  // another date, a game saved under the old date would land on the wrong puzzle,
  // so move it to the date of the puzzle whose circles it fits.
  function moveStrayGames() {
    var moved = false;
    ["games", "practice"].forEach(function (setName) {
      var set = store[setName];
      Object.keys(set).forEach(function (date) {
        var g = set[date];
        var here = PUZZLES.filter(function (p) { return p.date === date; })[0];
        if (!g || !g.turns || !g.turns.length || !here) return;
        var ids = function (p) { return Object.keys(p.regions).filter(function (k) { return p.regions[k].slot; }).sort().join(","); };
        var used = {};
        g.turns.forEach(function (t) { Object.keys(t).forEach(function (k) { used[k] = 1; }); });
        var fits = function (p) { var want = ids(p).split(","); return Object.keys(used).every(function (k) { return want.indexOf(k) >= 0; }); };
        if (fits(here)) return;
        var home = PUZZLES.filter(function (p) { return p.date !== date && fits(p) && !set[p.date]; })
          .sort(function (a, b) { return Math.abs(Date.parse(a.date) - Date.parse(date)) - Math.abs(Date.parse(b.date) - Date.parse(date)); })[0];
        if (home) {
          set[home.date] = g;
          if (setName === "games" && store.stats.lastWinDate === date) store.stats.lastWinDate = home.date;
        }
        delete set[date];
        moved = true;
      });
    });
    if (moved) try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }
  moveStrayGames();

  function save() {
    if (preview) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }

  // A streak survives only if the last win was today's puzzle or the one before it.
  // Puzzles are counted by position in the list, so a day with no puzzle doesn't break it.
  if (!preview) {
    var st = store.stats;
    if (st.lastWinDate) {
      var lastIdx = PUZZLES.findIndex(function (p) { return p.date === st.lastWinDate; });
      if (lastIdx < 0 || lastIdx < liveIndex - 1) { st.streak = 0; save(); }
    }
  }

  function freshGame() { return { turns: [], solved: [], status: "playing" }; }
  var game;
  if (preview) {
    game = freshGame();
  } else if (past) {
    // a past Venn finished on its day shows that result; otherwise play it for fun
    var onTheDay = store.games[puzzle.date];
    if (onTheDay && onTheDay.turns && onTheDay.status !== "playing") game = onTheDay;
    else game = store.practice[puzzle.date] = store.practice[puzzle.date] || freshGame();
  } else {
    game = store.games[puzzle.date] = store.games[puzzle.date] || freshGame();
  }
  if (!game.turns) { // saved by the first prototype (one guess per turn)
    game.turns = [];
    delete game.guesses;
  }

  // ---------- layouts ----------
  var LAYOUTS = {
    // the hand-drawn pair of circles (img/drawn/venn.png, 1000 x 750)
    // the hand-drawn three circles (img/drawn/venn3.png, 1000 x 824)
    drawn3: {
      w: 1000, h: 824,
      labels: [{ x: 449, y: -34 }, { x: 150, y: 858 }, { x: 850, y: 858 }],
      regions: {
        A: { x: 449, y: 165, w: 300 },
        B: { x: 216, y: 582, w: 260 },
        C: { x: 764, y: 531, w: 280 },
        AB: { x: 332, y: 370, w: 150 },
        AC: { x: 606, y: 342, w: 160 },
        BC: { x: 470, y: 610, w: 120 },
        ABC: { x: 467, y: 463, w: 110 }
      }
    },
    drawn2: {
      w: 1000, h: 750,
      regions: {
        A: { x: 176, y: 375, w: 270 },
        B: { x: 826, y: 375, w: 270 },
        AB: { x: 500, y: 385, w: 290 }
      }
    },
    2: {
      w: 400, h: 270,
      circles: [{ cx: 150, cy: 140, r: 118 }, { cx: 250, cy: 140, r: 118 }],
      labels: [{ x: 100, y: 14 }, { x: 300, y: 14 }],
      regions: {
        A: { x: 84, y: 140, w: 100 },
        B: { x: 316, y: 140, w: 100 },
        AB: { x: 200, y: 140, w: 112 }
      }
    },
    3: {
      w: 400, h: 400,
      circles: [{ cx: 200, cy: 145, r: 112 }, { cx: 143, cy: 243, r: 112 }, { cx: 257, cy: 243, r: 112 }],
      labels: [{ x: 200, y: 22 }, { x: 72, y: 390 }, { x: 328, y: 390 }],
      regions: {
        A: { x: 200, y: 82, w: 110 },
        B: { x: 98, y: 290, w: 100 },
        C: { x: 302, y: 290, w: 100 },
        AB: { x: 146, y: 178, w: 70 },
        AC: { x: 254, y: 178, w: 70 },
        BC: { x: 200, y: 300, w: 80 },
        ABC: { x: 200, y: 215, w: 66 }
      }
    }
  };

  // ---------- rendering ----------
  var justSolved = [];

  function isSolved(id) { return game.solved.indexOf(id) >= 0; }

  function lastResult(id) {
    if (isSolved(id)) return "green";
    for (var i = game.turns.length - 1; i >= 0; i--) {
      if (game.turns[i][id]) return game.turns[i][id].result;
    }
    return "";
  }

  function renderMeta() {
    if (DRAWN) $("siteName").innerHTML = '<img src="img/drawn/title.png" alt="' + esc(NAME) + '" width="600" height="180">';
    else $("siteName").textContent = NAME;
    // reverse days: the title flips to its mirror image and back
    $("siteName").classList.toggle("reverse-flip", puzzle.type === "reverse");
    document.title = NAME;
    var type = puzzle.type || "classic";
    var num = index >= 0 ? "#" + (index + 1) : "Sample";
    var dateTxt = "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(puzzle.date)) {
      var p = puzzle.date.split("-");
      dateTxt = new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    }
    $("meta").innerHTML = esc(num) + (dateTxt ? " · " + esc(dateTxt) : "") +
      (type !== "classic" ? ' <span class="badge ' + esc(type) + '">' + esc(type) + "</span>" : "");
    $("instruction").textContent = puzzle.instruction || "";
    if (preview) { $("previewBanner").hidden = false; $("previewBanner").textContent = previewReason; }
    if (past) {
      $("previewBanner").hidden = false;
      $("previewBanner").innerHTML = "A Venn of the Past, just for fun. It won't change your stats. " +
        '<a href="./">Back to today\'s Venn</a>';
    }

    if (useCountries) {
      $("suggestions").innerHTML = (window.VENN_COUNTRIES || []).map(function (c) {
        return '<option value="' + esc(c) + '">';
      }).join("");
    }

    var sp = puzzle.sponsor;
    if (sp && sp.name) {
      $("sponsor").hidden = false;
      $("sponsor").innerHTML = "Today's puzzle is supported by " +
        (sp.url ? '<a href="' + esc(sp.url) + '" target="_blank" rel="noopener">' + esc(sp.name) + "</a>" : esc(sp.name));
    }

    var foot = [];
    if (SITE.kofiUrl) foot.push('<a class="kofi" href="' + esc(SITE.kofiUrl) + '" target="_blank" rel="noopener">&#9749; Buy me a coffee</a>');
    if (SITE.footerSponsor && SITE.footerSponsor.name) {
      var fs = SITE.footerSponsor;
      foot.push("<div>Supported by " + (fs.url ? '<a href="' + esc(fs.url) + '" target="_blank" rel="noopener">' + esc(fs.name) + "</a>" : esc(fs.name)) + "</div>");
    }
    if (SITE.maker && SITE.maker.name) {
      foot.push('<div class="made-by">' +
        (SITE.maker.logo ? '<img src="' + esc(SITE.maker.logo) + '" alt="" width="32" height="32">' : "") +
        "Made by " + esc(SITE.maker.name) + "</div>");
    }
    if (DRAWN) foot.unshift('<div class="chain-divider" role="separator"></div>');
    if (!DRAWN && SITE.drawn !== false) {
      var p2 = new URLSearchParams(location.search); p2.delete("drawn");
      foot.push('<a class="plain-link" href="?' + esc(p2.toString()) + '">Switch to the hand-drawn look</a>');
    }
    $("footer").innerHTML = foot.join("");
    $("footer").hidden = !foot.length;
  }

  function renderBoard() {
    var useDrawn = DRAWN;
    var L = LAYOUTS[useDrawn ? "drawn" + nCircles : nCircles];
    if (useDrawn && nCircles === 3) {
      var svg = '<div class="venn-img three">' + ["A", "B", "C", "AB", "AC", "BC", "ABC"].map(function (k) {
        return '<div class="fill fill3-' + k + '"></div>';
      }).join("") + '<img src="img/drawn/venn3.png" alt="Venn diagram">' +
        (puzzle.circles || []).map(function (c, i) {
          var p = L.labels[i];
          return c && c.label ? '<span class="circle-label3" style="left:' + (p.x / L.w * 100) + "%;top:" + (p.y / L.h * 100) + '%">' + esc(c.label) + "</span>" : "";
        }).join("") + "</div>";
    } else if (useDrawn) {
      svg = '<div class="venn-img"><div class="fill fill-left"></div><div class="fill fill-lens"></div><div class="fill fill-right"></div><img src="img/drawn/venn.png" alt="Venn diagram"></div>';
    } else {
    svg = '<svg viewBox="0 0 ' + L.w + " " + L.h + '" role="img" aria-label="Venn diagram">';
    L.circles.forEach(function (c, i) {
      svg += '<circle class="c c' + i + '" cx="' + c.cx + '" cy="' + c.cy + '" r="' + c.r + '"/>';
    });
    (puzzle.circles || []).forEach(function (c, i) {
      if (c && c.label && L.labels[i]) {
        svg += '<text class="circle-label" x="' + L.labels[i].x + '" y="' + L.labels[i].y + '">' + esc(c.label) + "</text>";
      }
    });
    svg += "</svg>";
    }

    var html = svg;
    var over = game.status !== "playing";
    Object.keys(puzzle.regions).forEach(function (key) {
      var r = puzzle.regions[key];
      var pos = L.regions[key];
      if (!pos) return;
      var style = "left:" + (pos.x / L.w * 100) + "%;top:" + (pos.y / L.h * 100) + "%;width:" + (pos.w / L.w * 100) + "%";
      if (r.slot) {
        var solved = isSolved(key);
        var res = lastResult(key);
        var cls = "region slot" + (solved ? " solved" : over ? " missed" : "") + (justSolved.indexOf(key) >= 0 ? " flash" : "");
        var ans = solved || over ? esc(r.slot.answer) : '<span class="blank">?</span>';
        // a sentence with a gap, e.g. "The ___th biggest cities…": the answer goes in the gap
        if (r.slot.template) {
          var parts = r.slot.template.split("___");
          ans = esc(parts[0]) + '<span class="gap">' + ans + "</span>" + esc(parts.slice(1).join("___"));
          cls += " template";
        }
        html += '<div class="' + cls + '" style="' + style + '">' +
          (r.slot.hint && !r.slot.template ? '<div class="hint">' + esc(r.slot.hint) + "</div>" : "") +
          '<div class="answer">' + ans + "</div>" +
          '<span class="dot ' + res + '" title="' + esc(resultText(res)) + '"></span></div>';
      } else {
        var isAnswer = !!r.hint || (nCircles === 2 && key !== "AB");
        html += '<div class="region' + (isAnswer ? " text-answer" : "") + '" style="' + style + '">' +
          (r.hint ? '<div class="hint">' + esc(r.hint) + "</div>" : "") +
          '<div class="fixed">' + esc(r.text) + "</div></div>";
      }
    });
    $("board").innerHTML = html;
    $("board").classList.toggle("small", nCircles === 3);
  }

  function resultText(res) {
    return { green: "Right answer, right circle", blue: "Right answer, wrong circle", red: "Not an answer today" }[res] || "Not guessed yet";
  }

  function renderInputs() {
    var over = game.status !== "playing";
    $("guessRows").innerHTML = slots.map(function (s) {
      var solved = isSolved(s.id);
      var res = lastResult(s.id);
      var field = solved || over
        ? '<div class="locked">' + (solved ? esc(s.answer) : "&nbsp;") + "</div>"
        : '<input id="g-' + s.id + '" data-slot="' + s.id + '" type="text" placeholder="' + esc(isNumberSlot(s) ? "Type a number" : slotName(s.id)) + '"' +
          (isNumberSlot(s) ? ' inputmode="numeric"' : "") +
          ' aria-label="Guess for ' + esc(slotName(s.id)) + (s.hint ? ", clue " + esc(s.hint) : "") + '"' +
          (useCountries ? ' list="suggestions"' : "") + ' autocapitalize="words" spellcheck="false" enterkeyhint="next">';
      return '<div class="grow' + (solved ? " solved" : "") + '">' +
        '<span class="tag" style="--sw:' + slotSwatch(s.id) + '" title="' + esc(slotName(s.id)) + '">' + esc(s.hint || "") + "</span>" +
        field +
        '<span class="dot ' + res + '" title="' + esc(resultText(res)) + '"></span></div>';
    }).join("");

    var open = slots.filter(function (s) { return !isSolved(s.id); }).length;
    var left = maxTurns - game.turns.length;
    $("guessBtn").disabled = over;
    // the label sits in a span so the drawn button's pen lines can go over its colour fills
    $("guessBtn").innerHTML = '<span class="gb-label">' + esc(over ? (game.status === "won" ? "Solved!" : "Out of turns") :
      (open > 2 ? "Guess all" : open === 2 ? "Guess both" : "Guess") + " · " + left + " turn" + (left === 1 ? "" : "s") + " left") + "</span>";
    var last = $("guessRows").querySelectorAll("input");
    if (last.length) last[last.length - 1].setAttribute("enterkeyhint", "go");
  }

  function renderTurns() {
    var dots = "";
    for (var i = 0; i < maxTurns; i++) {
      dots += '<span class="' + (game.turns[i] ? "used" : "") + '"' +
        (DRAWN ? ' style="background-image:url(img/drawn/dot' + (i % 5 + 1) + '.png)' +
          (game.turns[i] ? ",radial-gradient(circle at 50% 52%, var(--ink) 0 38%, transparent 42%)" : "") + '"' : "") + "></span>";
    }
    $("guessDots").innerHTML = dots;
    $("guessDots").setAttribute("aria-label", game.turns.length + " of " + maxTurns + " turns used");

    $("turnList").innerHTML = game.turns.map(function (t) {
      return "<li>" + slots.map(function (s) {
        var e = t[s.id];
        if (!e) return '<span class="chip empty"></span>';
        return '<span class="chip ' + e.result + '" title="' + esc(resultText(e.result)) + '"><span class="dot ' + e.result + '"></span>' + esc(e.text) + "</span>";
      }).join("") + "</li>";
    }).join("");
    $("resultBtn").hidden = game.status === "playing";
  }

  function render() {
    renderBoard();
    renderInputs();
    renderTurns();
  }

  // ---------- playing ----------
  function inputFor(id) { return $("g-" + id); }

  function reject(input, msg) {
    shake();
    toast(msg);
    if (input) { input.focus(); input.select(); }
  }

  function submitTurn() {
    if (game.status !== "playing") return;
    var open = slots.filter(function (s) { return !isSolved(s.id); });
    var entries = open.map(function (s) { return { slot: s, input: inputFor(s.id), text: inputFor(s.id).value.trim() }; });

    var empty = entries.filter(function (e) { return !canon(e.text); })[0];
    if (empty) return reject(empty.input, open.length > 1 ? "Make a guess for every circle" : "Type a guess");

    var notNum = entries.filter(function (e) { return isNumberSlot(e.slot) && toNumber(e.text) === null; })[0];
    if (notNum) return reject(notNum.input, "Type a number");

    if (useCountries && puzzle.strict !== false) {
      var bad = entries.filter(function (e) { return !COUNTRY_CANON[norm(e.text)]; })[0];
      if (bad) return reject(bad.input, "“" + bad.text + "” isn't on the country list");
    }

    var repeat = entries.filter(function (e) {
      return game.turns.some(function (t) { return t[e.slot.id] && canon(t[e.slot.id].text, e.slot) === canon(e.text, e.slot); });
    })[0];
    if (repeat) return reject(repeat.input, "You've already tried " + repeat.text + " there");

    var turn = {};
    justSolved = [];
    entries.forEach(function (e) {
      var res = judge(e.slot, e.text);
      turn[e.slot.id] = { text: e.text, result: res };
      if (res === "green") { game.solved.push(e.slot.id); justSolved.push(e.slot.id); }
    });
    game.turns.push(turn);
    var unseenBefore = store.unseen.length;
    if (!preview && entries.some(function (e) { return /^(italy|rome)$/.test(norm(e.text)); })) unlock("rome", true);
    if (game.status === "playing") checkAwards();

    var anyBlue = entries.some(function (e) { return turn[e.slot.id].result === "blue"; });
    if (game.solved.length === slots.length) finish("won");
    else if (game.turns.length >= maxTurns) finish("lost");
    else if (justSolved.length) toast(justSolved.length > 1 ? "Two in one!" : "Got one!", 1300);
    else if (anyBlue) toast("Right answer, wrong circle", 1500);
    else { shake(); toast("Not this time", 1300); }

    save();
    render();
    var first = $("guessRows").querySelector("input");
    if (first) first.focus();
    // a rosette earned mid-game gets its own toast once the turn message has shown
    if (game.status === "playing" && store.unseen.length > unseenBefore) {
      var newest = store.unseen[store.unseen.length - 1];
      setTimeout(function () { toast("Rosette unlocked: " + rosetteTitle(newest), 2600); }, 1400);
    }
  }

  function shake() {
    var f = $("guessForm");
    f.classList.remove("shake");
    void f.offsetWidth;
    f.classList.add("shake");
  }

  function finish(status) {
    game.status = status;
    game.finishedAt = Date.now();
    if (!preview && !past) {
      var st = store.stats;
      st.played += 1;
      if (status === "won") {
        st.wins += 1;
        var prevIdx = st.lastWinDate ? PUZZLES.findIndex(function (p) { return p.date === st.lastWinDate; }) : -2;
        st.streak = prevIdx === index - 1 && prevIdx >= 0 ? st.streak + 1 : 1;
        st.maxStreak = Math.max(st.maxStreak, st.streak);
        st.lastWinDate = puzzle.date;
        st.lastWinIndex = index;
      } else {
        st.streak = 0;
      }
    }
    checkAwards();
    setTimeout(function () { openStats(); }, status === "won" ? 1100 : 1400);
  }

  // ---------- result / stats ----------
  var EMOJI = { green: "🟢", blue: "🔵", red: "🔴" };

  function shareText() {
    var num = index >= 0 ? "#" + (index + 1) + (past ? " (Venn of the Past)" : "") : "(sample)";
    var score = game.status === "won" ? game.turns.length + "/" + maxTurns : "X/" + maxTurns;
    var rows = game.turns.map(function (t) {
      return slots.map(function (s) { return t[s.id] ? EMOJI[t[s.id].result] : "⬜"; }).join("");
    }).join("\n");
    return NAME + " " + num + " " + score + "\n" + rows + "\n" + location.origin + location.pathname;
  }

  function openStats() {
    var rb = $("resultBlock");
    if (game.status !== "playing") {
      var won = game.status === "won";
      var answers = slots.map(function (s) {
        return s.template ? esc(s.template.replace("___", s.answer)) : esc(s.answer);
      }).join(" &middot; ");
      var h = '<div class="result-head">' +
        "<div>" + (won ? "Solved" : past ? "Not this time" : "Better luck tomorrow") + "</div>" +
        '<div class="big">' + (won ? game.turns.length + " / " + maxTurns + " turns" : "Out of turns") + "</div>" +
        '<div class="answers">' + answers + "</div></div>";
      if (puzzle.note || puzzle.source) {
        h += '<div class="note">' + (puzzle.note ? '<div class="label">The setter\'s story</div>' : "") +
          (puzzle.note ? "<div>" + esc(puzzle.note) + "</div>" : "") +
          (puzzle.source ? '<div class="source">Source: ' + (puzzle.sourceUrl
            ? '<a href="' + esc(puzzle.sourceUrl) + '" target="_blank" rel="noopener">' + esc(puzzle.source) + "</a>"
            : esc(puzzle.source)) +
            (puzzle.sources ? " (" + puzzle.sources.map(function (x) {
              return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.name) + "</a>";
            }).join(", ") + ")" : "") + "</div>" : "") + "</div>";
      }
      h += '<button class="primary share-btn" id="shareBtn" type="button">Share result</button>' +
        (DRAWN ? '<div class="chain-divider" role="separator"></div>' : '<hr class="sep">');
      rb.innerHTML = h;
      $("shareBtn").onclick = share;
    } else {
      rb.innerHTML = "";
    }

    var st = store.stats;
    var pct = st.played ? Math.round(st.wins / st.played * 100) : 0;
    $("statsGrid").innerHTML = [
      [st.played, "Played"], [pct, "Win %"], [st.streak, "Current streak"], [st.maxStreak, "Best streak"]
    ].map(function (x) {
      return '<div><div class="num">' + x[0] + '</div><div class="lbl">' + x[1] + "</div></div>";
    }).join("");

    // guess distribution and lifetime colours, worked out from saved daily games
    var dist = {}, cols = { green: 0, blue: 0, red: 0 }, losses = 0, top = 5;
    Object.keys(store.games).forEach(function (date) {
      var g = store.games[date];
      if (!g || !g.turns) return;
      if (g.status === "won") {
        dist[g.turns.length] = (dist[g.turns.length] || 0) + 1;
        top = Math.max(top, g.turns.length);
      } else if (g.status === "lost") losses++;
      g.turns.forEach(function (t) {
        Object.keys(t).forEach(function (id) { if (t[id] && cols[t[id].result] != null) cols[t[id].result]++; });
      });
    });
    var rows = [];
    for (var n = 1; n <= top; n++) rows.push([String(n), dist[n] || 0, !past && !preview && game.status === "won" && game.turns.length === n]);
    rows.push(["X", losses, !past && !preview && game.status === "lost"]);
    $("distGraph").innerHTML = pieChart(rows);
    $("colourTotals").innerHTML = [["green", "Right circle"], ["blue", "Wrong circle"], ["red", "Misses"]].map(function (c) {
      return '<div><div class="num"><span class="dot ' + c[0] + '"></span>' + cols[c[0]] + '</div><div class="lbl">' + c[1] + "</div></div>";
    }).join("");

    renderRosettes();
    renderStatsTitle();
    tickCountdown();
    var d = $("statsDialog");
    if (!d.open) d.showModal();
  }

  // Pie chart of results: one slice per number of turns, plus missed ("X").
  var PIE_COLOURS = ["#38618C", "#A2AD91", "#FA7921", "#D30C7B", "#5C573E", "#7f8fa6", "#c9a66b"];
  function pieChart(rows) {
    var total = rows.reduce(function (t, r) { return t + r[1]; }, 0);
    if (DRAWN) return drawnPie(rows, total);
    var R = 46, C = 50, svg = '<svg viewBox="0 0 100 100" class="pie" role="img" aria-label="Results by number of turns">';
    var colour = function (r, i) { return r[0] === "X" ? "#b9b2aa" : PIE_COLOURS[i % PIE_COLOURS.length]; };
    if (!total) {
      svg += '<circle cx="50" cy="50" r="' + R + '" class="pie-empty"/>';
    } else {
      var angle = -Math.PI / 2;
      rows.forEach(function (r, i) {
        if (!r[1]) return;
        var a = r[1] / total * Math.PI * 2;
        // today's slice is nudged out from the centre
        var mid = angle + a / 2, off = r[2] && r[1] < total ? 4 : 0;
        var dx = Math.cos(mid) * off, dy = Math.sin(mid) * off;
        var cls = r[2] ? ' class="now"' : "";
        if (r[1] === total) {
          svg += '<circle cx="50" cy="50" r="' + R + '" fill="' + colour(r, i) + '"' + cls + "/>";
        } else {
          var x1 = C + dx + R * Math.cos(angle), y1 = C + dy + R * Math.sin(angle);
          var x2 = C + dx + R * Math.cos(angle + a), y2 = C + dy + R * Math.sin(angle + a);
          svg += '<path d="M' + (C + dx).toFixed(2) + " " + (C + dy).toFixed(2) + " L" + x1.toFixed(2) + " " + y1.toFixed(2) +
            " A" + R + " " + R + " 0 " + (a > Math.PI ? 1 : 0) + " 1 " + x2.toFixed(2) + " " + y2.toFixed(2) + ' Z" fill="' + colour(r, i) + '"' + cls + "/>";
        }
        angle += a;
      });
    }
    svg += "</svg>";
    var legend = '<ul class="pie-legend">' + rows.map(function (r, i) {
      return '<li' + (r[2] ? ' class="now"' : "") + '><span class="sw" style="background:' + colour(r, i) + '"></span>' +
        (r[0] === "X" ? "Missed" : r[0] + (r[0] === "1" ? " turn" : " turns")) + '<span class="cnt">' + r[1] + "</span></li>";
    }).join("") + "</ul>";
    return svg + legend + (total ? "" : '<p class="pie-note">Your results will appear here.</p>');
  }

  function pieLegend(rows, colour, total) {
    return '<ul class="pie-legend">' + rows.map(function (r, i) {
      return '<li' + (r[2] ? ' class="now"' : "") + '><span class="sw" style="background:' + colour(r, i) + '"></span>' +
        (r[0] === "X" ? "Missed" : r[0] + (r[0] === "1" ? " turn" : " turns")) + '<span class="cnt">' + r[1] + "</span></li>";
    }).join("") + "</ul>" + (total ? "" : '<p class="pie-note">Your results will appear here.</p>');
  }

  // The same pie, cut to the shape of the hand-drawn circle
  // (img/drawn/pie-mask.png) with the drawn line on top (pie-outline.png).
  function drawnPie(rows, total) {
    var W = 474, H = 468, CX = 234, CY = 235, R = 500; // img/drawn/pie-outline.png
    var colour = function (r, i) { return r[0] === "X" ? "#b9b2aa" : PIE_COLOURS[i % PIE_COLOURS.length]; };
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="pie-fill" aria-hidden="true">';
    var angle = -Math.PI / 2;
    rows.forEach(function (r, i) {
      if (!r[1]) return;
      var a = r[1] / total * Math.PI * 2;
      var cls = r[2] ? ' class="now"' : "";
      if (r[1] === total) {
        svg += '<rect width="' + W + '" height="' + H + '" fill="' + colour(r, i) + '"' + cls + "/>";
      } else {
        var x1 = CX + R * Math.cos(angle), y1 = CY + R * Math.sin(angle);
        var x2 = CX + R * Math.cos(angle + a), y2 = CY + R * Math.sin(angle + a);
        svg += '<path d="M' + CX + " " + CY + " L" + x1.toFixed(1) + " " + y1.toFixed(1) +
          " A" + R + " " + R + " 0 " + (a > Math.PI ? 1 : 0) + " 1 " + x2.toFixed(1) + " " + y2.toFixed(1) + ' Z" fill="' + colour(r, i) + '"' + cls + "/>";
      }
      angle += a;
    });
    svg += "</svg>";
    return '<div class="pie-wrap" role="img" aria-label="Results by number of turns">' + (total ? svg : "") +
      '<img src="img/drawn/pie-outline.png" alt=""></div>' + pieLegend(rows, colour, total);
  }

  var countdownTimer;
  function tickCountdown() {
    clearInterval(countdownTimer);
    function upd() {
      var now = new Date();
      var mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      var s = Math.max(0, Math.floor((mid - now) / 1000));
      var hh = String(Math.floor(s / 3600)).padStart(2, "0");
      var mm = String(Math.floor(s % 3600 / 60)).padStart(2, "0");
      var ss = String(s % 60).padStart(2, "0");
      $("nextPuzzle").innerHTML = "Next puzzle in <strong>" + hh + ":" + mm + ":" + ss + "</strong>";
    }
    upd();
    countdownTimer = setInterval(upd, 1000);
  }

  function copy(text, okMsg) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, function () { fallbackCopy(text, okMsg); });
    }
    fallbackCopy(text, okMsg);
  }

  function fallbackCopy(text, okMsg) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    $("statsDialog").appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); toast(okMsg); } catch (e) { window.prompt("Copy this:", text); }
    ta.remove();
  }

  function share() {
    if (!preview) unlock("share");
    renderRosettes();
    var text = shareText();
    if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      navigator.share({ text: text }).catch(function () {});
    } else {
      copy(text, "Copied to clipboard");
    }
  }

  // ---------- Rosettes ----------
  // Titles only: how each one is earned is deliberately never shown.
  var ROSETTES = [
    { id: "played1", title: "Venn First I Played" },
    { id: "won", title: "Venn First I Won" },
    { id: "won4", title: "Venn It Rains It Fours" },
    { id: "green", title: "Venn One Knows" },
    { id: "share", title: "Venny Was A Friend Of Mine" },
    { id: "won2", title: "Van Deux Venn" },
    { id: "rome", title: "Venn In Rome" },
    { id: "won3", title: "Venn Three\u2019s A Crowd" },
    { id: "won1", title: "Venni Vidi Vici" },
    { id: "done20", title: "Venn Ever, Wherever" },
    { id: "corner", title: "Why Is That In The Corner Venn?" }
  ];
  var ROSETTE_COLOURS = ["#38618C", "#FA7921", "#D30C7B", "#A2AD91", "#5C573E"];

  function rosetteTitle(id) {
    for (var i = 0; i < ROSETTES.length; i++) if (ROSETTES[i].id === id) return ROSETTES[i].title;
    return id;
  }

  function unlock(id, quiet) {
    if (store.awards[id]) return;
    store.awards[id] = Date.now();
    store.unseen.push(id);
    save();
    if (!quiet && !document.querySelector("dialog[open]")) toast("Rosette unlocked: " + rosetteTitle(id), 2600);
  }

  // Awards that follow from saved games (daily and Venns of the Past, never previews).
  function checkAwards() {
    if (preview) return;
    var finished = 0;
    [store.games, store.practice].forEach(function (set) {
      Object.keys(set).forEach(function (date) {
        var g = set[date];
        if (!g || !g.turns) return;
        if (g.turns.some(function (t) { return Object.keys(t).some(function (k) { return t[k] && t[k].result === "green"; }); })) unlock("green", true);
        if (g.turns.some(function (t) { return Object.keys(t).some(function (k) { return t[k] && /^(italy|rome)$/.test(norm(t[k].text)); }); })) unlock("rome", true);
        if (g.status === "playing") return;
        finished++;
        if (g.status === "won") {
          var n = g.turns.length;
          if (n <= 5) unlock("won", true);
          if (n <= 4 && n >= 1) unlock("won" + n, true);
        }
      });
    });
    if (finished >= 1) unlock("played1", true);
    if (finished >= 20) unlock("done20", true);
    checkAvatars();
  }

  // ---------- Profile and avatars ----------
  var AVATARS = [
    { id: 1, name: "Venny Vennables" },
    { id: 2, name: "Venna Vennsen" },
    { id: 3, name: "Venndog Barkvenn" },
    { id: 4, name: "Beevenn Vennbee" },
    { id: 5, name: "Ol\u2019 Vennessa \u2018V\u2019 McVenn" },
    { id: 6, name: "Perpendicular Bird" }
  ];

  // finished games and best winning turn count, from daily games and Venns of the Past
  function playSummary() {
    var finished = 0, best = Infinity;
    [store.games, store.practice].forEach(function (set) {
      Object.keys(set).forEach(function (date) {
        var g = set[date];
        if (!g || !g.turns || g.status === "playing") return;
        finished++;
        if (g.status === "won") best = Math.min(best, g.turns.length);
      });
    });
    return { finished: finished, best: best };
  }

  function rosetteTotal() {
    return ROSETTES.filter(function (r) { return store.awards[r.id]; }).length;
  }

  // how each avatar is earned (never shown to the player)
  function avatarUnlocked(id) {
    var p = playSummary(), r = rosetteTotal();
    switch (id) {
      case 1: return true;
      case 2: return r >= 3;
      case 3: return p.best <= 3;
      case 4: return r >= 10;
      case 5: return p.best <= 5 && !!store.flags.vPressed;
      case 6: return p.finished >= 50 && r >= 10;
    }
    return false;
  }

  function avatarName(id) {
    for (var i = 0; i < AVATARS.length; i++) if (AVATARS[i].id === id) return AVATARS[i].name;
    return "";
  }

  function checkAvatars() {
    if (preview) return;
    var fresh = AVATARS.filter(function (a) { return avatarUnlocked(a.id) && store.avatarsKnown.indexOf(a.id) < 0; });
    if (!fresh.length) return;
    fresh.forEach(function (a) { store.avatarsKnown.push(a.id); });
    save();
    var names = fresh.map(function (a) { return a.name; });
    var msg = names.length === 1 ? "New avatar unlocked: " + names[0] :
      "New avatars unlocked: " + names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
    setTimeout(function () { if (!document.querySelector("dialog[open]")) toast(msg, 2800); }, 1800);
  }

  function currentAvatar() {
    var id = store.profile.avatar || 1;
    return avatarUnlocked(id) ? id : 1;
  }

  function openProfile() {
    $("profileName").value = store.profile.name || "";
    renderProfile();
    $("profileDialog").showModal();
  }

  function renderProfile() {
    var cur = currentAvatar(), got = 0;
    $("profileAvatar").src = "img/drawn/avatar" + cur + ".png";
    $("profileAvatar").alt = avatarName(cur);
    $("avatarList").innerHTML = AVATARS.map(function (a) {
      var open = avatarUnlocked(a.id);
      if (open) got++;
      return '<li><button type="button" class="avatar' + (open ? "" : " locked") + (a.id === cur ? " chosen" : "") + '"' +
        (open ? ' data-avatar="' + a.id + '"' : " disabled") + ' aria-pressed="' + (a.id === cur) + '">' +
        '<span class="avatar-pic">' + (open ? '<img src="img/drawn/avatar' + a.id + '.png" alt="">' : "") + "</span>" +
        '<span class="avatar-name">' + esc(a.name) + "</span></button></li>";
    }).join("");
    $("avatarCount").textContent = "· " + got + " of " + AVATARS.length;
  }

  function renderStatsTitle() {
    var name = (store.profile.name || "").trim();
    $("statsTitle").innerHTML = '<img class="stats-avatar" src="img/drawn/avatar' + currentAvatar() + '.png" alt="">' +
      (name ? esc(name) + "\u2019s stats" : "Your stats");
  }

  function rosetteSvg(colour) {
    // scalloped badge with two ribbon tails
    var pts = [], n = 14;
    for (var i = 0; i < n * 2; i++) {
      var r = i % 2 ? 19 : 23, a = Math.PI * i / n;
      pts.push((26 + r * Math.cos(a)).toFixed(1) + "," + (24 + r * Math.sin(a)).toFixed(1));
    }
    return '<svg viewBox="0 0 52 64" aria-hidden="true">' +
      '<path d="M17 36 L11 62 L19 56 L24 63 L27 40 Z" fill="' + colour + '" opacity="0.85"/>' +
      '<path d="M35 36 L41 62 L33 56 L28 63 L25 40 Z" fill="' + colour + '" opacity="0.7"/>' +
      '<polygon points="' + pts.join(" ") + '" fill="' + colour + '" stroke="var(--ink)" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<circle cx="26" cy="24" r="13" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.2"/>' +
      '<circle cx="22" cy="24" r="6" fill="' + colour + '" fill-opacity="0.55"/><circle cx="30" cy="24" r="6" fill="' + colour + '" fill-opacity="0.55"/>' +
      "</svg>";
  }

  // the hand-drawn rosette (img/drawn/rosette.png), coloured in through three masks
  // three different drawn rosettes, taken in turn
  function drawnRosette(colour, i) {
    var v = i % 3 + 1;
    return '<span class="ros v' + v + '" style="--rc:' + colour + '" aria-hidden="true">' +
      '<i class="ros-ribbon"></i><i class="ros-ring"></i><i class="ros-inner"></i>' +
      '<img src="img/drawn/rosette' + v + '.png" alt="">' +
      '<svg class="ros-venn" viewBox="0 0 26 16"><circle cx="9" cy="8" r="6.5"/><circle cx="17" cy="8" r="6.5"/></svg></span>';
  }

  function renderRosettes() {
    var got = 0;
    $("rosettes").innerHTML = ROSETTES.map(function (r, i) {
      var have = !!store.awards[r.id];
      if (have) got++;
      var fresh = store.unseen.indexOf(r.id) >= 0;
      return '<li class="' + (have ? "unlocked" : "locked") + (fresh ? " new" : "") + '">' +
        (DRAWN ? drawnRosette(ROSETTE_COLOURS[i % ROSETTE_COLOURS.length], i) : rosetteSvg(ROSETTE_COLOURS[i % ROSETTE_COLOURS.length])) +
        '<span class="rtitle">' + esc(r.title) + "</span></li>";
    }).join("");
    $("rosetteCount").textContent = "· " + got + " of " + ROSETTES.length;
  }

  // ---------- Venns of the Past ----------
  function openPast() {
    var items = [];
    for (var i = liveIndex - 1; i >= 0; i--) {
      var p = PUZZLES[i];
      var day = store.games[p.date], fun = store.practice[p.date];
      var status = "Not played", cls = "";
      if (day && day.turns && day.status === "won") { status = "Solved in " + day.turns.length; cls = "won"; }
      else if (day && day.turns && day.status === "lost") { status = "Missed"; cls = "lost"; }
      else if (fun && fun.status === "won") { status = "Solved for fun in " + fun.turns.length; cls = "won"; }
      else if (fun && fun.status === "lost") { status = "Missed (for fun)"; cls = "lost"; }
      else if (fun && fun.turns && fun.turns.length) { status = "In progress"; }
      var c = coloursFor(p, i);
      var dp = p.date.split("-");
      var dateTxt = new Date(+dp[0], +dp[1] - 1, +dp[2]).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      var keep = DRAWN ? "" : "&drawn=0";
      items.push('<li><a href="?d=' + esc(p.date) + keep + '">' +
        '<span class="mini" style="--a:' + esc(c[0]) + ";--b:" + esc(c[1]) + '"></span>' +
        '<span class="ptext"><span><strong>#' + (i + 1) + "</strong> · " + esc(dateTxt) +
        (p.type && p.type !== "classic" ? ' <span class="badge ' + esc(p.type) + '">' + esc(p.type) + "</span>" : "") +
        '</span><span class="pstatus ' + cls + '">' + esc(status) + "</span></span></a></li>");
    }
    $("pastList").innerHTML = items.length ? items.join("") :
      '<li class="empty">No past Venns yet. Today\'s is the first one, so come back tomorrow.</li>';
    $("pastDialog").showModal();
  }

  // ---------- backup ----------
  function exportCode() {
    var json = JSON.stringify({ v: 1, stats: store.stats, games: store.games, practice: store.practice, awards: store.awards,
      profile: store.profile, flags: store.flags, avatarsKnown: store.avatarsKnown });
    var code = btoa(unescape(encodeURIComponent(json)));
    copy(code, "Code copied. Paste it on your other device.");
  }

  function importCode() {
    var code = window.prompt("Paste your code:");
    if (!code) return;
    try {
      var data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
      if (!data || !data.stats) throw new Error("bad");
      if (!window.confirm("Replace the stats on this device with the ones from your code?")) return;
      store.stats = Object.assign(defaultStore().stats, data.stats);
      store.games = data.games || {};
      store.practice = data.practice || {};
      store.awards = data.awards || {};
      store.profile = Object.assign({ name: "", avatar: 1 }, data.profile || {});
      store.flags = data.flags || {};
      store.avatarsKnown = data.avatarsKnown || [1];
      store.seenHelp = true;
      preview = false;
      save();
      location.reload();
    } catch (e) {
      toast("That code didn't work");
    }
  }

  // ---------- wiring ----------
  $("guessForm").addEventListener("submit", function (e) {
    e.preventDefault();
    submitTurn();
  });
  // Enter in a field moves to the next empty field; on the last one it submits.
  $("guessRows").addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
    var inputs = Array.prototype.slice.call($("guessRows").querySelectorAll("input"));
    var next = inputs.filter(function (i) { return i !== e.target && !i.value.trim(); })[0];
    if (next && e.target.value.trim()) { e.preventDefault(); next.focus(); }
  });
  $("helpBtn").onclick = function () { $("helpDialog").showModal(); };
  $("pastBtn").onclick = openPast;
  $("profileBtn").onclick = openProfile;
  $("profileName").addEventListener("input", function () {
    store.profile.name = this.value.slice(0, 24);
    save();
  });
  $("avatarList").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-avatar]");
    if (!b) return;
    store.profile.avatar = +b.getAttribute("data-avatar");
    save();
    renderProfile();
  });
  // the V drawing in the corner: part of how one avatar is earned
  $("cornerV").onclick = function () {
    var v = this;
    v.classList.remove("wiggle"); void v.offsetWidth; v.classList.add("wiggle");
    if (preview || store.flags.vPressed) return;
    store.flags.vPressed = true;
    save();
    checkAvatars();
  };
  // the "CORNER" drawing: unlocks a rosette and switches to the plain look
  $("cornerCircle").onclick = function () {
    if (!preview) unlock("corner", true);
    var p3 = new URLSearchParams(location.search);
    p3.set("drawn", "0");
    location.search = p3.toString();
  };
  $("pastLink").onclick = function () { $("statsDialog").close(); openPast(); };
  $("statsBtn").onclick = openStats;
  $("resultBtn").onclick = openStats;
  $("exportBtn").onclick = exportCode;
  $("importBtn").onclick = importCode;

  document.querySelectorAll("dialog").forEach(function (d) {
    d.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close")) { d.close(); return; }
      if (e.target === d) {
        var r = d.getBoundingClientRect();
        var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) d.close(); // click on the backdrop
      }
    });
    d.addEventListener("close", function () {
      if (d.id === "helpDialog" && !store.seenHelp) { store.seenHelp = true; save(); }
      if (d.id === "statsDialog" && store.unseen.length) { store.unseen = []; save(); }
      var first = $("guessRows").querySelector("input");
      if (first) first.focus();
    });
  });

  renderMeta();
  render();
  checkAwards();
  if (store.unseen.length && !preview) {
    setTimeout(function () {
      if (document.querySelector("dialog[open]")) return;
      toast(store.unseen.length === 1 ? "Rosette unlocked: " + rosetteTitle(store.unseen[0]) :
        store.unseen.length + " new rosettes: see your stats", 2600);
    }, 400);
  }

  if (!store.seenHelp && !preview) {
    $("helpDialog").showModal();
  } else if (game.status !== "playing") {
    openStats();
  }
})();
