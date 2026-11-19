// Unit tests for pkg/payload/ui/main.js: loads it into a stub global with node's vm.
// usage: node test/main.test.js
"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const src = fs.readFileSync(__dirname + "/../pkg/payload/ui/main.js", "utf8");

function load(extra) {
  const g = Object.assign({}, extra || {});
  vm.createContext(g);
  vm.runInContext(src, g);
  return g;
}

// a CSS rule stub: style values as "Nms" strings
function rule(sel, dur, delay) {
  const v = { "animation-duration": dur, "animation-delay": delay };
  return { selectorText: sel, style: {
    getPropertyValue: (p) => v[p] || "",
    setProperty: (p, x) => { v[p] = x; },
  }, v };
}
function env(sheets, levels, proto) {
  return { document: { styleSheets: sheets }, log: { _logLevels: levels || { __global__: 2 } },
           Websockets: proto ? { prototype: proto } : undefined };
}
const conf = (o) => Object.assign({ animMs: 300, logs: "warn", wsfix: true }, o);

const S = load().RevisedSpeedup;

// scaleMs
assert.strictEqual(S.scaleMs(600, 300), 300);
assert.strictEqual(S.scaleMs(400, 300), 200);
assert.strictEqual(S.scaleMs(100, 50), 8);
assert.strictEqual(S.scaleMs(50, 50), 4);
assert.strictEqual(S.scaleMs(0, 300), 0, "zero delay stays zero");
assert.strictEqual(S.scaleMs(5, 50), 1, "non-zero floors to 1");
assert.strictEqual(S.scaleMs(600, 800), 800);

// gate
assert.strictEqual(S.gate("info"), 2);
assert.strictEqual(S.gate("warn"), 3);
assert.strictEqual(S.gate("error"), 4);
assert.strictEqual(S.gate("bogus"), 3);

// anim: only .Transitions_ rules, "s" units too, a throwing sheet is skipped
{
  const a = rule(".Transitions_fadeIn_300_300", "300ms", "300ms");
  const b = rule(".Other", "300ms", "0ms");
  const c = rule(".Transitions_slide_0_400", "0.4s", "0ms");
  const bad = {}; Object.defineProperty(bad, "cssRules", { get() { throw new Error("denied"); } });
  const r = S.apply(conf(), env([bad, { cssRules: [a, b] }, { cssRules: [c] }], null, {}));
  assert.strictEqual(r.anim, 2);
  assert.deepStrictEqual([a.v["animation-duration"], a.v["animation-delay"]], ["150ms", "150ms"]);
  assert.strictEqual(b.v["animation-duration"], "300ms", "non-transition rule untouched");
  assert.deepStrictEqual([c.v["animation-duration"], c.v["animation-delay"]], ["200ms", "0ms"]);
}

// logs
{
  const lv = { __global__: 2 };
  assert.strictEqual(S.apply(conf({ logs: "warn" }), env([], lv)).logs, 3);
  assert.strictEqual(lv.__global__, 3);
  S.apply(conf({ logs: "error" }), env([], lv));
  assert.strictEqual(lv.__global__, 4);
}

// wsfix: helpers defined with stock semantics; existing ones untouched; switch off = untouched
{
  const g = load();
  const proto = {};
  const r = g.RevisedSpeedup.apply(conf(), env([], null, proto));
  assert.strictEqual(r.wsfix, true);
  const ws = Object.create(proto);
  ws._waitMsgArray = [["focusStack", 7], ["transition", 7]];
  assert.strictEqual(ws._isStack("focusStack", 7), true);
  assert.strictEqual(g.mStackOutput, "focusStack");
  assert.strictEqual(ws._isStack("focusStack", 8), false);
  ws._delStack("focusStack", 7);
  assert.deepStrictEqual(ws._waitMsgArray, [["transition", 7]]);

  const own = function () {};
  const p2 = { _isStack: own, _delStack: own };
  assert.strictEqual(S.apply(conf(), env([], null, p2)).wsfix, false);
  assert.strictEqual(p2._isStack, own);

  const p3 = {};
  assert.strictEqual(S.apply(conf({ wsfix: false }), env([], null, p3)).wsfix, false);
  assert.strictEqual(p3._isStack, undefined);
}

// conf missing or out of range -> defaults (300 / warn / on)
{
  const a = rule(".Transitions_x", "600ms", "0ms");
  const lv = { __global__: 2 };
  const r = S.apply(undefined, env([{ cssRules: [a] }], lv, {}));
  assert.deepStrictEqual([a.v["animation-duration"], lv.__global__, r.wsfix], ["300ms", 3, true]);
  const b = rule(".Transitions_x", "600ms", "0ms");
  S.apply({ animMs: 5000, logs: "warn", wsfix: true }, env([{ cssRules: [b] }]));
  assert.strictEqual(b.v["animation-duration"], "300ms", "out-of-range animMs falls back to 300");
}

console.log("main.test.js ok");

// timer cleanup (UMP slides) scaled with the CSS, so it never fires mid-animation
{
  const seen = [];
  const T = function () {};
  T.prototype._setCleanupByTimer = function (ms) { seen.push([this.id, ms]); };
  const e = env([]); e.Transitions = T;
  const r = S.apply(conf({ animMs: 800 }), e);
  assert.strictEqual(r.timer, true);
  const t = new T(); t.id = "x";
  t._setCleanupByTimer(400); t._setCleanupByTimer(500); t._setCleanupByTimer(0);
  assert.deepStrictEqual(seen, [["x", 533], ["x", 667], ["x", 0]], "same factor as CSS, this kept, 0 stays 0");
  assert.strictEqual(S.apply(conf(), env([])).timer, false, "no Transitions: skipped");
}

// start-up: the status line is logged before the gate goes up (info lines are dropped above it)
{
  let script = null, logged = null;
  const levels = { __global__: 2 };
  const head = { appendChild: (s) => { script = s; } };
  const g = load({
    document: { createElement: () => ({}), head, styleSheets: [] },
    log: { _logLevels: levels },
    RevisedHMI: { log: (m) => { logged = [m, levels.__global__]; } },
  });
  g.RevisedSpeedupConf = { animMs: 300, logs: "error", wsfix: true };
  script.onload();
  assert.ok(logged, "status line logged");
  assert.strictEqual(logged[1], 2, "logged while the gate was still stock");
  assert.ok(/gate=4/.test(logged[0]), logged[0]);
  assert.strictEqual(levels.__global__, 4, "gate raised after logging");
}
console.log("main.test.js ok");
