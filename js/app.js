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
  var puzzle, index, preview = false, previewReason = "";

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
      var liveIndex = -1;
      PUZZLES.forEach(function (p, i) { if (p.date <= today) liveIndex = i; });
      if (index !== Math.max(liveIndex, 0)) {
        preview = true;
        previewReason = "Previewing the puzzle for " + puzzle.date + ". Nothing is saved.";
      }
    }
  }

  if (!puzzle) {
    $("instruction").textContent = "No puzzle yet. Add one in js/puzzles.js.";
    return;
  }

  var maxTurns = puzzle.maxGuesses || 5;
  var nCircles = puzzle.circles && puzzle.circles.length === 3 ? 3 : 2;
  var useCountries = puzzle.suggest === "countries";

  var slots = [];
  Object.keys(puzzle.regions).forEach(function (key) {
    var r = puzzle.regions[key];
    if (r.slot) slots.push(Object.assign({ id: key }, r.slot));
  });

  function canon(s) {
    var n = norm(s);
    return useCountries && COUNTRY_CANON[n] ? COUNTRY_CANON[n] : n;
  }

  function matches(slot, guess) {
    var g = canon(guess);
    var accepted = (slot.accept && slot.accept.length ? slot.accept : [slot.answer]).concat([slot.answer]);
    if (accepted.some(function (a) { return canon(a) === g; })) return true;
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
    var cols = id.split("").map(function (l) { return "var(--c" + "ABC".indexOf(l) + ")"; });
    return cols.length === 1 ? cols[0] : "linear-gradient(90deg," + cols.join(",") + ")";
  }

  // ---------- storage ----------
  function defaultStore() {
    return {
      stats: { played: 0, wins: 0, streak: 0, maxStreak: 0, lastWinIndex: null, lastWinDate: null },
      games: {},
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
          seenHelp: !!s.seenHelp
        };
      }
    } catch (e) { /* storage blocked or corrupt */ }
    return defaultStore();
  }

  var store = loadStore();

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
      if (lastIdx < 0 || lastIdx < index - 1) { st.streak = 0; save(); }
    }
  }

  var game = (!preview && store.games[puzzle.date]) || { turns: [], solved: [], status: "playing" };
  if (!game.turns) { // saved by the first prototype (one guess per turn)
    game.turns = [];
    delete game.guesses;
  }
  if (!preview) store.games[puzzle.date] = game;

  // ---------- layouts ----------
  var LAYOUTS = {
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
    $("siteName").textContent = NAME;
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
    $("footer").innerHTML = foot.join("");
    $("footer").hidden = !foot.length;
  }

  function renderBoard() {
    var L = LAYOUTS[nCircles];
    var svg = '<svg viewBox="0 0 ' + L.w + " " + L.h + '" role="img" aria-label="Venn diagram">';
    L.circles.forEach(function (c, i) {
      svg += '<circle class="c c' + i + '" cx="' + c.cx + '" cy="' + c.cy + '" r="' + c.r + '"/>';
    });
    (puzzle.circles || []).forEach(function (c, i) {
      if (c && c.label && L.labels[i]) {
        svg += '<text class="circle-label" x="' + L.labels[i].x + '" y="' + L.labels[i].y + '">' + esc(c.label) + "</text>";
      }
    });
    svg += "</svg>";

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
        html += '<div class="' + cls + '" style="' + style + '">' +
          (r.slot.hint ? '<div class="hint">' + esc(r.slot.hint) + "</div>" : "") +
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
        : '<input id="g-' + s.id + '" data-slot="' + s.id + '" type="text" placeholder="' + esc(slotName(s.id)) + '"' +
          ' aria-label="Guess for ' + esc(slotName(s.id)) + (s.hint ? ", clue " + esc(s.hint) : "") + '"' +
          (useCountries ? ' list="suggestions"' : "") + ' autocapitalize="words" spellcheck="false" enterkeyhint="next">';
      return '<div class="grow' + (solved ? " solved" : "") + '">' +
        '<span class="tag" style="background:' + slotSwatch(s.id) + '" title="' + esc(slotName(s.id)) + '">' + esc(s.hint || "") + "</span>" +
        field +
        '<span class="dot ' + res + '" title="' + esc(resultText(res)) + '"></span></div>';
    }).join("");

    var open = slots.filter(function (s) { return !isSolved(s.id); }).length;
    var left = maxTurns - game.turns.length;
    $("guessBtn").disabled = over;
    $("guessBtn").textContent = over ? (game.status === "won" ? "Solved!" : "Out of turns") :
      (open > 2 ? "Guess all" : open === 2 ? "Guess both" : "Guess") + " · " + left + " turn" + (left === 1 ? "" : "s") + " left";
    var last = $("guessRows").querySelectorAll("input");
    if (last.length) last[last.length - 1].setAttribute("enterkeyhint", "go");
  }

  function renderTurns() {
    var dots = "";
    for (var i = 0; i < maxTurns; i++) dots += '<span class="' + (game.turns[i] ? "used" : "") + '"></span>';
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

    if (useCountries && puzzle.strict !== false) {
      var bad = entries.filter(function (e) { return !COUNTRY_CANON[norm(e.text)]; })[0];
      if (bad) return reject(bad.input, "“" + bad.text + "” isn't on the country list");
    }

    var repeat = entries.filter(function (e) {
      return game.turns.some(function (t) { return t[e.slot.id] && canon(t[e.slot.id].text) === canon(e.text); });
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
    if (!preview) {
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
    setTimeout(function () { openStats(); }, status === "won" ? 1100 : 1400);
  }

  // ---------- result / stats ----------
  var EMOJI = { green: "🟢", blue: "🔵", red: "🔴" };

  function shareText() {
    var num = index >= 0 ? "#" + (index + 1) : "(sample)";
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
      var answers = slots.map(function (s) { return esc(s.answer); }).join(" &middot; ");
      var h = '<div class="result-head">' +
        "<div>" + (won ? "Solved" : "Better luck tomorrow") + "</div>" +
        '<div class="big">' + (won ? game.turns.length + " / " + maxTurns + " turns" : "Out of turns") + "</div>" +
        '<div class="answers">' + answers + "</div></div>";
      if (puzzle.note || puzzle.source) {
        h += '<div class="note"><div class="label">From the puzzle maker</div>' +
          (puzzle.note ? "<div>" + esc(puzzle.note) + "</div>" : "") +
          (puzzle.source ? '<div class="source">Source: ' + esc(puzzle.source) + "</div>" : "") + "</div>";
      }
      h += '<button class="primary share-btn" id="shareBtn" type="button">Share result</button><hr class="sep">';
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

    tickCountdown();
    var d = $("statsDialog");
    if (!d.open) d.showModal();
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
    var text = shareText();
    if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      navigator.share({ text: text }).catch(function () {});
    } else {
      copy(text, "Copied to clipboard");
    }
  }

  // ---------- backup ----------
  function exportCode() {
    var json = JSON.stringify({ v: 1, stats: store.stats, games: store.games });
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
      var first = $("guessRows").querySelector("input");
      if (first) first.focus();
    });
  });

  renderMeta();
  render();

  if (!store.seenHelp && !preview) {
    $("helpDialog").showModal();
  } else if (game.status !== "playing") {
    openStats();
  }
})();
