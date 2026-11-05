import fs from "fs"; import vm from "vm"; import assert from "assert/strict";
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL("../logic.js", import.meta.url), "utf8"), ctx);
const R = ctx.Roulette; let n = 0; const t = (name, fn) => { fn(); n++; console.log("  ✓", name); };
const opts = [{ label: "Tacos", weight: 1 }, { label: "Pizza", weight: 2 }, { label: "Sushi", weight: 1 }];

t("segments cover the full circle proportionally", () => {
  const s = R.segments(opts); assert.ok(Math.abs(s[2].end - R.TAU) < 1e-9); assert.ok(Math.abs(s[1].span - Math.PI) < 1e-9);
});
t("pickIndex respects weights", () => {
  assert.equal(R.pickIndex(opts, 0), 0); assert.equal(R.pickIndex(opts, 0.24), 0); assert.equal(R.pickIndex(opts, 0.26), 1);
  assert.equal(R.pickIndex(opts, 0.74), 1); assert.equal(R.pickIndex(opts, 0.76), 2); assert.equal(R.pickIndex(opts, 0.9999), 2);
});
t("weighted picks are statistically fair", () => {
  const c = [0, 0, 0]; for (let i = 0; i < 40000; i++) c[R.pickIndex(opts, Math.random())]++;
  assert.ok(Math.abs(c[1] / 40000 - 0.5) < 0.02 && Math.abs(c[0] / 40000 - 0.25) < 0.02);
});
t("the wheel visually lands on the picked option (any start angle)", () => {
  for (let k = 0; k < 3000; k++) {
    const idx = Math.floor(Math.random() * 3), cur = (Math.random() - 0.5) * 100;
    const fin = R.targetRotation(opts, cur, idx, Math.random(), 5);
    assert.equal(R.indexAtPointer(opts, fin), idx);
    assert.ok(fin - cur >= 5 * R.TAU && fin - cur < 6 * R.TAU);
  }
});
t("share hash round-trips labels, weights, mode, unicode", () => {
  const o = [{ label: "Thai 🍜", weight: 3 }, { label: "Burgers & fries", weight: 1 }];
  const h = R.encode(o, "elim"); const d = R.decode(h);
  assert.equal(d.mode, "elim"); assert.deepEqual(JSON.parse(JSON.stringify(d.options)), o);
});
t("decode rejects junk and sanitizes", () => {
  assert.equal(R.decode(""), null); assert.equal(R.decode("#o=OnlyOne"), null); assert.equal(R.decode("#o=%E0%A4%A|b").options.length, 2); // malformed escape does not throw
  const d = R.decode("#o=a*99|b*-3|c&m=evil"); assert.equal(d.options[0].weight, 5); assert.equal(d.options[1].weight, 1); assert.equal(d.mode, "single");
});
t("cleanOptions trims, caps count and length", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ label: "  opt" + i + "  ", weight: 2 }));
  const c = R.cleanOptions(many); assert.equal(c.length, R.MAX_OPTIONS); assert.equal(c[0].label, "opt0");
  assert.equal(R.cleanOptions([{ label: "x".repeat(99) }])[0].label.length, 40);
});
t("best-of-3 winner", () => { assert.equal(R.best3Winner({ 0: 1, 2: 1 }), null); assert.equal(R.best3Winner({ 0: 1, 2: 2 }), 2); });
t("chance %", () => { assert.equal(R.chance(opts, 1), 50); assert.equal(R.chance(opts, 0), 25); });
console.log(`\ndecision-roulette: ${n} tests passed`);
