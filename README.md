# clox

Fullscreen analog + vintage-digital clock screensavers, rendered on a single
`<canvas>` at 60 fps. Zero dependencies, zero build step — double-click
`index.html` or run `clox.bat` for instant kiosk-mode fullscreen.

Resolution-independent: everything is drawn relative to the window size with
`devicePixelRatio` scaling, so 1080p, 1440p (2K), and 4K all render crisp.

## Faces

| Face | Style |
|---|---|
| **Redline · 80s LED** | Retro red seven-segment alarm clock: ghost segments, bloom, blinking colon, PM/ALARM indicators, smoked-glass window, scanlines, floor reflection |
| **Flip · Solari** | Split-flap clock with gravity-eased flap animation, axle pins, AM/PM tag, date line |
| **Sweep · Wall Clock** | Brushed-metal bezel, ivory dial, serif numerals, date window, continuous sweep second hand, glass highlight |
| **Station · Swiss Railway** | SBB clock: bar markers, red lollipop second hand that sweeps in 58.5s and pauses at 12, minute hand snaps with spring overshoot |
| **Nixie · IN-18** | Glass tubes on a walnut base, unlit cathode stacks, honeycomb anode mesh, warm orange glow, neon-dot separators |
| **VFD · Hi-Fi** | Cyan vacuum-fluorescent display behind dark receiver glass, weekday indicator row, dot-matrix texture |

## Run it

- **Kiosk / screensaver mode:** double-click `clox.bat` (Chrome, falls back to Edge). `Alt+F4` or `Ctrl+W` to exit.
- **Normal:** open `index.html` in any Chromium browser, press `F` or click for fullscreen.

While fullscreen, clox requests a screen wake lock so the display stays on.

## Controls

| Key | Action |
|---|---|
| `←` / `→` / `Space` | Switch face |
| `F` / click | Toggle fullscreen |
| `S` | Toggle seconds |
| `H` | Toggle 12/24-hour |
| `A` | Auto-cycle faces every 2 minutes |
| `?` | Show help |

Settings and the last face persist in `localStorage`.

## Use as a Windows screensaver

Windows `.scr` files are just renamed executables, so a true `.scr` needs a
native wrapper. The practical setups:

1. **Manual:** run `clox.bat` when stepping away (set Windows *Screen timeout*
   to Never while it runs — the wake lock handles this in fullscreen).
2. **Task Scheduler:** trigger `clox.bat` on idle (Task Scheduler → trigger
   "On idle") and disable the stock screensaver.

## Architecture

```
index.html          script tags (classic, not ESM — file:// safe)
css/style.css       canvas fill, toast/hint overlays, cursor hiding
js/util.js          registry, easings, time parts, seven-segment renderer
js/engine.js        rAF loop, DPR resize, input, settings, wake lock
js/faces/*.js       one file per face; each calls CLOX.register({id, name, draw})
```

Adding a face: create `js/faces/myface.js`, call
`CLOX.register({ id, name, draw(ctx, W, H, date, settings, now) })`,
add a `<script defer>` tag to `index.html`. `W`/`H` are CSS pixels
(DPR already applied to the context transform).

Classic scripts instead of ES modules is deliberate: Chrome blocks module
imports over `file://`, and a screensaver must work with a double-click.
