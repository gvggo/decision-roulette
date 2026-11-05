(function () {
  const R = window.Roulette;
  const $ = (id) => document.getElementById(id);
  const STORE = "roulette:v1";
  const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#eab308", "#6366f1", "#ef4444", "#22c55e", "#0ea5e9", "#d946ef", "#f97316", "#84cc16", "#06b6d4"];
  const PRESETS = {
    "🍕 Dinner": ["Pizza", "Tacos", "Sushi", "Burgers", "Thai", "Cook at home"],
    "🎬 Movie night": ["Comedy", "Horror", "Action", "Rom-com", "Documentary", "Rewatch a classic"],
    "🧽 Who does dishes": ["Alex", "Sam", "Jordan", "Taylor"],
    "🎲 Weekend plan": ["Hike", "Board games", "Museum", "Beach", "Stay in", "Road trip"],
    "🤔 Yes / No": ["Yes", "No", "Ask again tomorrow"]
  };
  const TWISTS = ["…but the person who suggested it pays.", "…and the loudest objector picks the music.", "…but you have to go in 30 minutes or it's void.", "…and everyone has to say one nice thing about it.", "…and the runner-up gets next time, no arguments.", "…but loser of rock-paper-scissors chooses the seats.", "…and nobody is allowed to check their phone during it.", "…and you must rate it out of 10 afterwards."];
  const HINTS = { single: "Winner takes all.", best3: "First option to win 2 spins takes it.", elim: "Each spin knocks one out. Last one standing wins." };

  function rand() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }

  let state = load();
  let rot = 0, spinning = false, round = { tally: {}, out: [] };
  function load() {
    const fromHash = R.decode(location.hash);
    if (fromHash) return fromHash;
    try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.options && s.options.length >= 2) return { options: R.cleanOptions(s.options), mode: s.mode || "single" }; } catch {}
    return { options: PRESETS["🍕 Dinner"].map((label) => ({ label, weight: 1 })), mode: "single" };
  }
  function persist() { localStorage.setItem(STORE, JSON.stringify(state)); history.replaceState(null, "", R.encode(state.options, state.mode)); }

  function active() { return state.options.map((o, i) => ({ ...o, i })).filter((o) => !round.out.includes(o.i)); }

  function draw() {
    const cv = $("wheel"), ctx = cv.getContext("2d"), W = cv.width, c = W / 2, r = c - 10;
    ctx.clearRect(0, 0, W, W);
    const opts = active();
    if (opts.length === 0) return;
    const segs = R.segments(opts);
    ctx.save(); ctx.translate(c, c); ctx.rotate(rot - Math.PI / 2);
    segs.forEach((s, k) => {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, s.start, s.end); ctx.closePath();
      ctx.fillStyle = COLORS[opts[k].i % COLORS.length]; ctx.fill();
      if (opts.length > 1) { ctx.strokeStyle = "#0f1020"; ctx.lineWidth = 4; ctx.stroke(); }
      ctx.save(); ctx.rotate(s.start + s.span / 2); ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff"; ctx.shadowColor = "#0008"; ctx.shadowBlur = 6;
      const fs = Math.max(16, Math.min(34, 520 / Math.max(6, opts.length) + (s.span > 1 ? 6 : 0)));
      ctx.font = `800 ${fs}px system-ui, sans-serif`;
      let label = opts[k].label; if (label.length > 16) label = label.slice(0, 15) + "…";
      ctx.fillText(label, r - 24, 0); ctx.restore();
    });
    ctx.restore();
    ctx.beginPath(); ctx.arc(c, c, r, 0, R.TAU); ctx.lineWidth = 10; ctx.strokeStyle = "#ffffffcc"; ctx.stroke();
  }

  function renderList() {
    const ul = $("list"); ul.innerHTML = "";
    state.options.forEach((o, i) => {
      const li = document.createElement("li");
      if (round.out.includes(i)) li.className = "out";
      li.innerHTML = `<span class="dot" style="background:${COLORS[i % COLORS.length]}"></span><input type="text" maxlength="40" aria-label="Option ${i + 1}" /><select aria-label="Weight">${[1, 2, 3, 4, 5].map((w) => `<option ${w === o.weight ? "selected" : ""}>${w}</option>`).join("")}</select><button class="x" aria-label="Remove">✕</button>`;
      const inp = li.querySelector("input"); inp.value = o.label;
      inp.addEventListener("change", () => { const v = inp.value.replace(/[|*]/g, " ").trim(); if (v) { o.label = v.slice(0, 40); } else inp.value = o.label; changed(); });
      li.querySelector("select").addEventListener("change", (e) => { o.weight = R.clampWeight(e.target.value); changed(); });
      li.querySelector(".x").addEventListener("click", () => { if (state.options.length <= 2) return toast("A wheel needs at least 2 options"); state.options.splice(i, 1); changed(true); });
      ul.appendChild(li);
    });
    $("count").textContent = `(${state.options.length}/${R.MAX_OPTIONS})`;
    document.querySelectorAll(".mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === state.mode));
    $("modeHint").textContent = HINTS[state.mode];
  }
  function changed(resetRound) { if (resetRound !== false) newRound(); persist(); renderList(); draw(); }
  function newRound() { round = { tally: {}, out: [] }; }

  function spin() {
    if (spinning) return;
    let opts = active();
    if (opts.length < 2 || isFinished()) { newRound(); renderList(); opts = active(); }
    const k = R.pickIndex(opts, rand());
    const start = rot, end = R.targetRotation(opts, rot, k, rand(), 5 + Math.floor(rand() * 3));
    const dur = 4200 + rand() * 1200, t0 = performance.now();
    spinning = true; $("spinBtn").disabled = true;
    $("result").innerHTML = '<p class="hint">Spinning…</p>';
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      rot = start + (end - start) * R.easeOutCubic(t); draw();
      if (t < 1) return requestAnimationFrame(step);
      rot = R.mod(rot, R.TAU); spinning = false; $("spinBtn").disabled = false;
      landed(opts[k].i);
    };
    requestAnimationFrame(step);
  }
  function isFinished() { return round.done; }
  function landed(i) {
    const label = state.options[i].label;
    if (state.mode === "single") return finish(i, `${R.chance(state.options, i)}% chance — and it happened.`);
    if (state.mode === "best3") {
      round.tally[i] = (round.tally[i] || 0) + 1;
      const w = R.best3Winner(round.tally);
      if (w !== null) return finish(w, "Won 2 spins. Undisputed.");
      const score = Object.entries(round.tally).map(([k, v]) => `${state.options[k].label} ${v}`).join(" · ");
      return show(`<p class="hint">Point to</p><p class="big">${esc(label)}</p><p class="hint">${esc(score)} — spin again!</p>`);
    }
    round.out.push(i); renderList();
    const left = active();
    if (left.length === 1) { draw(); return finish(left[0].i, "Survived every elimination."); }
    draw();
    show(`<p class="hint">Knocked out</p><p class="big">❌ ${esc(label)}</p><p class="hint">${left.length} left — spin again!</p>`);
  }
  let lastResult = "";
  function finish(i, sub) {
    round.done = true;
    const label = state.options[i].label;
    const tw = $("twist").checked ? TWISTS[Math.floor(rand() * TWISTS.length)] : "";
    lastResult = `🎡 The wheel has spoken: ${label}${tw ? " " + tw : ""}`;
    show(`<p class="hint">The wheel has spoken</p><p class="big">🎉 ${esc(label)}</p>${tw ? `<p class="twist">${esc(tw)}</p>` : ""}<p class="hint">${esc(sub)}</p><div class="row" style="justify-content:center"><button class="btn primary" id="shareRes">Share result</button></div>`);
    $("shareRes").addEventListener("click", () => share(lastResult));
    confetti();
  }
  function show(html) { $("result").innerHTML = html; }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function confetti() {
    const em = ["🎉", "✨", "🎊", "⭐"];
    for (let k = 0; k < 24; k++) {
      const s = document.createElement("span"); s.className = "confetti"; s.textContent = em[k % em.length];
      s.style.left = rand() * 100 + "vw"; s.style.animationDelay = rand() * 0.6 + "s";
      document.body.appendChild(s); setTimeout(() => s.remove(), 3200);
    }
  }
  async function share(text) {
    const url = location.origin + location.pathname + R.encode(state.options, state.mode);
    try { if (navigator.share) { await navigator.share({ title: "Decision Roulette", text, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text ? text + "\n" + url : url); toast(text ? "Result + wheel link copied!" : "Wheel link copied — send it to the group!"); }
    catch { toast("Copy failed — copy the address bar instead."); }
  }
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2200); }

  $("spinBtn").addEventListener("click", spin);
  $("addForm").addEventListener("submit", (e) => {
    e.preventDefault(); const v = $("newOpt").value.replace(/[|*]/g, " ").trim();
    if (!v) return; if (state.options.length >= R.MAX_OPTIONS) return toast(`Max ${R.MAX_OPTIONS} options`);
    state.options.push({ label: v.slice(0, 40), weight: 1 }); $("newOpt").value = ""; changed();
  });
  document.querySelectorAll(".mode").forEach((b) => b.addEventListener("click", () => { state.mode = b.dataset.mode; changed(); show('<p class="hint">' + HINTS[state.mode] + " Hit SPIN.</p>"); }));
  const pre = $("presets");
  Object.keys(PRESETS).forEach((name) => {
    const b = document.createElement("button"); b.className = "btn chip"; b.textContent = name;
    b.addEventListener("click", () => { state.options = PRESETS[name].map((label) => ({ label, weight: 1 })); changed(); });
    pre.appendChild(b);
  });
  $("shareWheel").addEventListener("click", () => share(""));
  $("resetBtn").addEventListener("click", () => { newRound(); renderList(); draw(); show('<p class="hint">Fresh round. Hit SPIN.</p>'); });
  window.addEventListener("hashchange", () => { const d = R.decode(location.hash); if (d) { state = d; newRound(); renderList(); draw(); } });
  document.addEventListener("keydown", (e) => { if (e.code === "Space" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); spin(); } });

  persist(); renderList(); draw();
})();
