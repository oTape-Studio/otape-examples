# oTAPE web player (TypeScript)

An embeddable, production-ready player for [oTAPE 1.0](https://github.com/otape-studio/otape-spec) cassettes.
One custom element, `<otape-player>`, on top of three layers you can also use on their own:

- **core**: opens and validates `.otape` files, with no DOM needed;
- **deck**: tape transport with streaming playback;
- **render**: SVG drawings of the cassette and J-card from the manifest.

```html
<script type="module" src="otape-player/register.js"></script>
<otape-player src="night-drive.otape" droppable></otape-player>
```

## Features

|                                                                                                                                                                | Spec              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Lazy ZIP reading: only the directory and manifest are read on open; stored audio streams from disk as a Blob slice, so a 90-minute side costs almost no memory | §3                |
| Full reader validation that collects **every** problem, each with a stable code and its spec section; optional values that are malformed become warnings       | §16.1             |
| Exact length: sound is cut at `recorded_frames`, then the tape runs on through blank tape                                                                      | §5.5, §7.3        |
| A deck, not a playlist: winding takes time, markers are reached by winding, sides end, flipping maps _p_ → _L − p_                                             | §5.4, §7.4, §7.5  |
| Procedural cassette: shell colour and transparency, five label styles, six lettering roles, keep-out zone                                                      | §10, §12.4, §12.5 |
| Artwork layered on top when present: face, label and J-card images                                                                                             | §12.3             |
| Animated reels and a three-digit counter driven by the tape-pack model                                                                                         | Appendix B.3      |
| Side and position remembered per `cassette.id`; the file is never modified                                                                                     | §14               |
| Rights shown, licence file shown as text only                                                                                                                  | §6.4              |
| Unknown codecs still open; the side is reported as unplayable                                                                                                  | §7.3              |

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The demo loads `public/examples/demo-tape.otape`, and you can drop any `.otape` file on
the player.

## Scripts

| Script              | What it does                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`       | Demo with hot reload                                                                                                |
| `npm run build`     | Typecheck, then build the demo (`dist/demo`), the library (`dist/lib`) and its type declarations (`dist/lib/types`) |
| `npm run preview`   | Serve the built demo                                                                                                |
| `npm test`          | Run the Vitest suite once (`npm run test:watch` to keep it running)                                                 |
| `npm run coverage`  | Tests with a V8 coverage report                                                                                     |
| `npm run lint`      | ESLint with `typescript-eslint` strict and stylistic type-checked rules                                             |
| `npm run format`    | Prettier                                                                                                            |
| `npm run check`     | Typecheck, lint, format check and tests: what CI runs                                                               |
| `npm run make:demo` | Rebuild `demo-tape.otape` from synthesised audio (macOS, uses `afconvert`)                                          |

## Deploying

`npm run build` produces two things:

- **`dist/demo/`**: a static site. Host it anywhere: GitHub Pages, Netlify, an S3 bucket.
- **`dist/lib/`**: the library for your own pages. Copy it next to your site and load `register.js`, or import
  `otape-player.js` from your bundler. Type declarations are in `dist/lib/types/`.

Cassettes are fetched with `fetch()`, so a `src` on another origin needs CORS headers. The player loads no fonts
itself: add `FONT_STYLESHEET_URL` (the open fonts of the six lettering roles) to your page for the intended look, or
let the font stacks fall back to system fonts.

## The element

### Attributes and properties

| Attribute   | Property       |                                                                     |
| ----------- | -------------- | ------------------------------------------------------------------- |
| `src`       | `src`          | URL of a cassette to load                                           |
| `droppable` | `droppable`    | Accept cassettes dropped on the player or chosen with a file picker |
|             | `deck`         | The `Deck` inside, for anything the buttons don't cover             |
|             | `cassette`     | The inserted cassette, or `null`                                    |
|             | `labels`       | Every text the player shows, to reword or translate it              |
|             | `load(source)` | Insert a cassette from a `File`, `Blob` or URL                      |

### Events

All bubble and cross the shadow boundary, and are typed on `HTMLElementEventMap`:

```ts
player.addEventListener('otape-load', (event) => console.log(event.detail.cassette.title));
player.addEventListener('otape-change', (event) => console.log(event.detail.mode, event.detail.side));
player.addEventListener('otape-error', (event) => console.error(event.detail.error));
```

### Theming

Set custom properties on the element, or style its parts:

```css
otape-player {
  --otape-accent: #3fa7d6;
  --otape-display: #0c1320;
  --otape-display-text: #8fd3ff;
  --otape-radius: 8px;
}

otape-player::part(display) {
  font-size: 14px;
}
```

Parts: `player`, `stage`, `cassette`, `empty`, `display`, `transport`, `info`. The player adapts its layout to its
own width with a container query, and respects `prefers-reduced-motion`.

### Translating

```ts
import { DEFAULT_LABELS } from 'otape-web-player';

player.labels = {
  play: 'Odtwórz',
  stop: 'Stop',
  modes: { ...DEFAULT_LABELS.modes, playing: 'Odtwarzanie' },
  side: (side) => `Strona ${side}`,
};
```

### Keyboard

While focus is inside the player: <kbd>K</kbd> play/stop, <kbd>J</kbd> rewind, <kbd>L</kbd> fast forward,
<kbd>F</kbd> flip. The tape map is a slider: arrow keys, <kbd>Home</kbd> and <kbd>End</kbd> wind the tape there.

## Using the layers directly

Validate a file without playing it, for example on upload:

```ts
import { CassetteFile, OTapeError, describeIssue } from 'otape-web-player';

try {
  const { cassette } = await CassetteFile.open(file);
  console.log(cassette.title, cassette.typeLabel, cassette.warnings.map(describeIssue));
} catch (error) {
  if (error instanceof OTapeError) console.error(error.issues.map(describeIssue));
}
```

Build your own UI on the deck:

```ts
import { CassetteFile, CassetteView, Deck } from 'otape-web-player';

const deck = new Deck();
await deck.insert(await CassetteFile.fetch('night-drive.otape'));

const view = new CassetteView(deck.cassette!, deck.side);
document.body.append(view.element);

deck.on('change', () => console.log(deck.mode, deck.side, deck.counter));
await deck.play();
requestAnimationFrame(function frame() {
  if (deck.reels) view.update(deck.reels);
  requestAnimationFrame(frame);
});
```

`Deck` takes its `PlaybackOutput`, `PositionStore` and clock as options, so you can route sound through Web Audio,
keep positions on your server, or drive time from tests.

## Architecture

```
src/
├── core/                    no DOM: runs in browsers, workers and Node
│   ├── constants.ts         values of the specification, as typed enums
│   ├── issues.ts            typed catalogue of every problem, OTapeError
│   ├── zip/                 lazy Blob-based ZIP reader, bounded inflate
│   ├── manifest/            manifest types, path rules, validation
│   └── cassette/            the Cassette model, CassetteFile (open, audio, artwork)
├── deck/                    transport
│   ├── deck.ts              state machine, cancellation of stale async work
│   ├── tape-head.ts         head position as anchor + speed, injectable clock
│   ├── reel-model.ts        Appendix B.3 tape packs and counter
│   ├── playback-output.ts   PlaybackOutput interface, <audio> implementation
│   └── position-store.ts    Web Storage and in-memory stores
├── render/                  SVG, geometry in millimetres (§12)
├── element/                 <otape-player>: template, styles, labels, icons
├── util/                    guards, colours, time, typed emitter
├── index.ts                 public API
└── register.ts              defines <otape-player>
```

`element` uses `deck` and `render`, both use `core`, and anything may use `util`. `core` imports none of the other
layers and has no DOM, so it can validate files on a server or in a worker.

### Engineering notes

- **TypeScript at its strictest**: `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`.
- **The manifest is `unknown` until validated.** Type guards narrow it; nothing is cast before the checks pass.
- **Issues are typed end to end**: `createIssue('side-length-mismatch', { type, expected })` only compiles with the
  details that message needs.
- **Every transport command wins.** Starting audio is asynchronous; a token makes any later command cancel it, so the
  deck can't end up playing after you pressed stop.
- **No untrusted markup.** Cassette text only ever reaches the page through `textContent` or SVG text nodes, and only
  `http(s)` licence links become clickable (§17).

## Tests

The Vitest suite has 100 tests:

- the example manifests and cassettes of the specification, including every `invalid-*` file, which must be rejected;
- the ZIP reader, including ZIP64, encrypted entries and decompression bombs;
- the deck with fake timers and a fake output: real-time play, cut at `recorded_frames`, winding, cueing, flipping,
  resuming, cancellation;
- the drawings: label styles, artwork layering, reels;
- the element in happy-dom: loading, errors, labels, keyboard, markup injection.

`core` and `deck` tests run in Node; `render` and `element` tests run in happy-dom.

## Browser support

Current Chrome, Edge, Firefox and Safari: custom elements, `DecompressionStream('deflate-raw')`,
`Intl.Segmenter`, container queries, and AAC in `<audio>`.

## What it leaves out

Recording (§9), the booklet (§12.7), drawing the J-card spine and flap, and showing history (§13).

## Licence

The code is released under the [MIT License](../../LICENSE). `public/examples/sample-tones.otape`,
`public/examples/blank-c60.otape` and everything in `test/fixtures/` are copied from
[otape-spec](https://github.com/otape-studio/otape-spec) and remain under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) © 2026 Jan Osio. `public/examples/demo-tape.otape` is
generated by `scripts/make-demo-cassette.ts` and dedicated to the public domain (CC0 1.0).
