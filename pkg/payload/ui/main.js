/* cmu-re-speedup: background HMI mod (ES5, Opera/Presto 12).
 * Loaded by the store's sdk.js at HMI start, after the GUI framework is up.
 * 1. scales the screen-transition CSS animations (.Transitions_* rules)
 * 2. raises the GUI log gate (log._logLevels.__global__)
 * 3. defines Websockets.prototype._isStack/_delStack, which the stock handler calls as methods
 * Nothing is written to disk; uninstall + HMI restart = stock behaviour. */
(function (w) {
  var STOCK_MAX_MS = 600;   // longest stock transition (Crossfade); anim_ms is its new length
  var CONF_SRC = "/data_persist/cmu-re/pkg/cmu-re-speedup/ui/conf.js";
  var DEFAULTS = { animMs: 300, logs: "warn", wsfix: true };
  var GATES = { info: 2, warn: 3, error: 4 };

  function scaleMs(ms, animMs) {
    if (ms <= 0) return 0;
    return Math.max(1, Math.round(ms * animMs / STOCK_MAX_MS));
  }

  function gate(name) { return GATES.hasOwnProperty(name) ? GATES[name] : GATES.warn; }

  function clean(c) {
    c = c || {};
    var n = c.animMs;
    return {
      animMs: (typeof n === "number" && n >= 50 && n <= 800) ? n : DEFAULTS.animMs,
      logs: GATES.hasOwnProperty(c.logs) ? c.logs : DEFAULTS.logs,
      wsfix: typeof c.wsfix === "boolean" ? c.wsfix : DEFAULTS.wsfix
    };
  }

  // "300ms" | "0.3s" -> ms, or null
  function toMs(v) {
    var n = parseFloat(v);
    if (isNaN(n)) return null;
    return /ms\s*$/.test(v) ? n : n * 1000;
  }

  function scaleRule(st, prop, animMs) {
    var ms = toMs(st.getPropertyValue(prop));
    if (ms !== null) st.setProperty(prop, scaleMs(ms, animMs) + "ms", "");
  }

  function scaleAnimations(doc, animMs) {
    var sheets = doc.styleSheets, n = 0, i, j, rules, r;
    for (i = 0; i < sheets.length; i++) {
      try { rules = sheets[i].cssRules; } catch (e) { continue; }   // unreadable sheet: skip
      if (!rules) continue;
      for (j = 0; j < rules.length; j++) {
        r = rules[j];
        if (!r.selectorText || r.selectorText.indexOf(".Transitions_") !== 0) continue;
        scaleRule(r.style, "animation-duration", animMs);
        scaleRule(r.style, "animation-delay", animMs);
        n++;
      }
    }
    return n;
  }

  function fixWebsockets(proto) {
    if (!proto || typeof proto._isStack === "function") return false;
    // match on [message, seq]; the hit message goes to the handler's global mStackOutput
    proto._isStack = function (msg, seq) {
      var a = this._waitMsgArray || [], i, hit = false;
      for (i = 0; i < a.length; i++) {
        if (a[i] && a[i][0] === msg && a[i][1] === seq) { w.mStackOutput = a[i][0]; hit = true; }
      }
      return hit;
    };
    if (typeof proto._delStack !== "function") {
      proto._delStack = function (msg, seq) {
        var a = this._waitMsgArray || [], i;
        for (i = a.length - 1; i >= 0; i--) {
          if (a[i] && a[i][0] === msg && a[i][1] === seq) a.splice(i, 1);
        }
      };
    }
    return true;
  }

  function apply(conf, env) {
    var c = clean(conf), out = { anim: 0, logs: 0, wsfix: false };
    try { out.anim = scaleAnimations(env.document, c.animMs); } catch (e) { out.anim = -1; }
    try {
      if (env.log && env.log._logLevels) { env.log._logLevels.__global__ = gate(c.logs); out.logs = gate(c.logs); }
    } catch (e2) { out.logs = -1; }
    try { out.wsfix = c.wsfix && !!env.Websockets && fixWebsockets(env.Websockets.prototype); } catch (e3) { out.wsfix = false; }
    return out;
  }

  w.RevisedSpeedup = { scaleMs: scaleMs, gate: gate, apply: apply };

  function start() {
    var done = false;
    function run() {
      if (done) return;
      done = true;
      var c = clean(w.RevisedSpeedupConf);
      var r = apply(c, { document: w.document, log: w.log, Websockets: w.Websockets });
      w.RevisedHMI.log("speedup anim=" + r.anim + " rules (" + c.animMs + " ms), gate=" + r.logs + ", wsfix=" + r.wsfix);
    }
    var s = w.document.createElement("script");
    s.src = CONF_SRC;
    s.onload = run;
    s.onerror = run;   // no conf.js yet: defaults
    (w.document.head || w.document.getElementsByTagName("head")[0]).appendChild(s);
  }

  if (w.RevisedHMI && w.document) start();
})(this);
