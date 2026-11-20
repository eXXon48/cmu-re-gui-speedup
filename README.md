# cmu-re-speedup (Speed-up)

**A faster-feeling factory screen on the Mazda CMU150 (firmware 74.00.324A).**

A background HMI mod. It changes no system file: `ui/main.js` runs inside the HMI at start-up
(loaded by the Revised Store's `sdk.js`) and makes three run-time changes:

1. **Screen-change animations.** Scales the `animation-duration` and `animation-delay` of the
   `.Transitions_*` CSS rules. The setting is the new length of the longest stock transition
   (600 ms); the others keep their stock proportion. Minimum 1 ms, so `animationend` still fires.
   The timer that ends the slide transitions is scaled by the same factor.
2. **GUI log level.** Raises the global gate of the GUI logger. Calls below the gate return
   before the stack capture and the native log write. Errors are always logged.
3. **Message handler fix (disabled).** The stock MMUI WebSocket handler calls two helpers as
   methods that exist only as global functions, so it can throw and skip the rest of the
   message. The fix (define them on the prototype) is in the code but switched off: the bench
   unit logged no such error. It comes back if the HMI log shows them.

## Settings

| Setting | Range | Default |
|---|---|---|
| Screen change time (ms) | 50–800, step 50 (600 = stock) | 300 |
| GUI log level | Normal (stock) · Warning · Critical | Warning |

Changes apply at the next HMI start.

## Install / revert

Install or uninstall it in the Revised Store (needs store 0.7.0.2 or later). Uninstall and
restart: the HMI is back to stock, nothing to restore.

## Test

```sh
sh test/run.sh    # manifest + hmi.json parse, ES5 grep, main.js against stub globals (node)
```

## Build

```sh
sh tools/mkpkg.sh <version> <path/to/rvp-pack> cmu-re-speedup-<version>.rvp
```

`rvp-pack` comes from the Revised Store repo and must support manifest `config`. Releases: push
a `vN` tag on `main`, or a `dev/vN` tag on `develop` for a dev prerelease; CI packs the `.rvp`
and attaches it to the GitHub release.

## Verified

Local HMI sim (desktop Opera 12.10, Presto 2.12.388, stock-HMI stub), 2026-11-19:

- The store's `sdk.js` loads `ui/main.js` at page start; `main.js` loads `ui/conf.js`.
- Presto accepts `style.setProperty("animation-duration", "150ms")` on a `CSSStyleRule` and
  reads the value back in seconds (`0.15s`); no fallback sheet needed. Test rules scaled at
  300 ms: `300ms → 150ms`, `0.6s → 300ms`, delay `0ms` stays `0`.
- Log gate set to 3.
- Settings change (50 ms / Critical / fix off) regenerates `conf.js`; the next page start
  reads the new values.
- Uninstall removes the jail and the registry entry; the next page start has no mod globals.

The sim has no stock transition CSS, GUI logger or MMUI WebSocket, so the real rule count and
the timing numbers come from the bench.
