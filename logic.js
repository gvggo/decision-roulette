/* Decision Roulette core logic — pure functions, no DOM. */
(function (root) {
  const TAU = Math.PI * 2;
  const MAX_OPTIONS = 16;

  function clampWeight(w) { w = Math.round(Number(w)); return Number.isFinite(w) ? Math.min(5, Math.max(1, w)) : 1; }
  function cleanOptions(list) {
    const out = [];
    for (const o of list || []) {
      const label = String(o.label || "").replace(/[|*]/g, " ").trim().slice(0, 40);
      if (label) out.push({ label, weight: clampWeight(o.weight) });
      if (out.length >= MAX_OPTIONS) break;
    }
    return out;
  }
  // Segments measured clockwise from 12 o'clock, in radians.
  function segments(options) {
    const total = options.reduce((s, o) => s + o.weight, 0);
    let a = 0;
    return options.map((o) => { const span = (o.weight / total) * TAU; const seg = { start: a, end: a + span, span }; a += span; return seg; });
  }
  function pickIndex(options, r) { // r in [0,1)
    const total = options.reduce((s, o) => s + o.weight, 0);
    let x = r * total;
    for (let i = 0; i < options.length; i++) { x -= options[i].weight; if (x < 0) return i; }
    return options.length - 1;
  }
  function mod(a, m) { return ((a % m) + m) % m; }
  // Wheel rotated clockwise by `rot`; pointer is fixed at 12 o'clock.
  function indexAtPointer(options, rot) {
    const a = mod(-rot, TAU);
    const segs = segments(options);
    for (let i = 0; i < segs.length; i++) if (a >= segs[i].start && a < segs[i].end) return i;
    return segs.length - 1;
  }
  // Final rotation that lands the pointer inside segment `index` (away from edges).
  function targetRotation(options, current, index, r, spins) {
    const seg = segments(options)[index];
    const a = seg.start + (0.15 + 0.7 * r) * seg.span;
    return current + spins * TAU + mod(-a - current, TAU);
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function encode(options, mode) {
    const o = options.map((x) => encodeURIComponent(x.label) + (x.weight > 1 ? "*" + x.weight : "")).join("|");
    return "#o=" + o + (mode && mode !== "single" ? "&m=" + mode : "");
  }
  function decode(hash) {
    const h = String(hash || "").replace(/^#/, "");
    const params = {};
    for (const part of h.split("&")) { const i = part.indexOf("="); if (i > 0) params[part.slice(0, i)] = part.slice(i + 1); }
    if (!params.o) return null;
    const options = cleanOptions(params.o.split("|").map((p) => {
      const [l, w] = p.split("*");
      let label; try { label = decodeURIComponent(l); } catch { label = l; }
      return { label, weight: w ? Number(w) : 1 };
    }));
    const mode = ["single", "best3", "elim"].includes(params.m) ? params.m : "single";
    return options.length >= 2 ? { options, mode } : null;
  }
  // Best of 3: first to 2 wins. tally = {index: wins}
  function best3Winner(tally) {
    for (const k of Object.keys(tally)) if (tally[k] >= 2) return Number(k);
    return null;
  }
  function chance(options, i) {
    const total = options.reduce((s, o) => s + o.weight, 0);
    return Math.round((options[i].weight / total) * 100);
  }
  root.Roulette = { TAU, MAX_OPTIONS, clampWeight, cleanOptions, segments, pickIndex, indexAtPointer, targetRotation, easeOutCubic, encode, decode, best3Winner, chance, mod };
})(typeof window !== "undefined" ? window : globalThis);
