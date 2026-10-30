# Simplest oTAPE player (JavaScript)

A minimal, dependency-free oTAPE 1.0 player for the browser, meant as a starting point for developers.
Every module has one job, is commented, and names the specification rule (`§…`) next to the code
that implements it.

## Run it

The demo uses ES modules, which browsers only load over HTTP, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>, choose or drop an `.otape` file, or load the example cassette.

## Test it

The tests use Node's built-in test runner (Node 22 or later) and need no installation:

```bash
npm test
```

They cover the ZIP reader, every manifest rule (including the valid and `invalid-*` example manifests of the
specification), the cassette model, the tape head and the player's transport logic.

## Layout

```
simplest-player/
├── index.html              demo page
├── demo/
│   ├── app.js              UI glue: file opening, buttons, display
│   ├── labels.js           every text the demo shows
│   └── styles.css
├── src/                    the player library
│   ├── index.js            public API
│   ├── constants.js        values from the spec and the player's enums
│   ├── errors.js           OTapeError, error codes and their messages
│   ├── zip-archive.js      read-only ZIP reader (§3)
│   ├── manifest.js         parsing and validation (§6, §16.1)
│   ├── cassette.js         opening a file into a cassette model
│   ├── time.js             frames ↔ seconds, time display (§5.3)
│   ├── tape-head.js        where the head is, as the tape moves
│   ├── audio-output.js     Web Audio decoding and playback
│   ├── position-store.js   side and position per cassette.id (§14)
│   └── player.js           the deck: coordinates all of the above
├── test/                   node:test unit tests and fixtures
└── examples/
    └── sample-tones.otape  the example cassette from otape-spec (CC BY 4.0)
```

Read the library in this order: `constants.js` → `zip-archive.js` → `manifest.js` → `cassette.js` →
`tape-head.js` → `player.js`.

### Responsibilities

| Module | Knows about | Does not know about |
| --- | --- | --- |
| `ZipArchive` | ZIP records | oTAPE |
| `manifest.js` | the rules of the spec | ZIP, audio, the browser |
| `openCassette` | turning a file into a model | playback |
| `TapeHead` | position, speed, time | cassettes, audio |
| `AudioOutput` | the Web Audio API | tapes |
| `PositionStore` | `localStorage` | everything else |
| `Player` | transport: play, wind, stop, flip | how any of the above work |
| `demo/` | the page | oTAPE rules |

`Player` takes its `AudioOutput` and `PositionStore` as constructor options, so tests (or another platform)
can pass their own.

## Use it

```js
import { Player, PlayerEvent, OTapeError } from './src/index.js';

const player = new Player();

player.addEventListener(PlayerEvent.CHANGE, () => {
  console.log(player.mode, player.side);
});

try {
  await player.load(await file.arrayBuffer());
  player.play();
} catch (error) {
  if (error instanceof OTapeError) {
    console.error(error.code, error.section, error.message);   // e.g. "side-length-mismatch", "§5.1", …
  }
}
```

### Player

| Member | Description |
| --- | --- |
| `load(arrayBuffer)` | Inserts a cassette. Rejects with an `OTapeError` naming the broken rule; the previous cassette stays in. |
| `play()`, `stop()` | Real-time playback from the head. Past the recording the tape runs in silence. |
| `fastForward()`, `rewind()` | Wind at 20× until STOP or the end of the side. |
| `flip()` | Turn the cassette over: head *p* on one side becomes *L − p* on the other. |
| `eject()` | Take the cassette out. |
| `cassette` | The cassette model (below), or `null`. |
| `side`, `mode`, `head` | `Side.A`/`Side.B`, a `Mode` value, the head in seconds. |
| `sideSeconds`, `currentSide`, `currentMarker`, `onBlankTape` | Shortcuts for a display. |
| `PlayerEvent.CHANGE` | Fired when the cassette, side or mode changes. The head moves continuously: poll `head` in `requestAnimationFrame`. |

### Cassette model

```js
{
  manifest,                 // the parsed manifest.json, untouched
  id, title, creator,
  typeLabel,                // "C60", or "C74" for a custom length
  rate,                     // timeline frames per second
  sideSeconds,
  sides: {
    A: { letter, title, writeProtect, codec, recordedSeconds, markers, buffer, playable },
    B: { … },
  },
}
```

## What it implements

- ZIP container with stored and deflate entries and ZIP64 (§3).
- The reader checks of §16.1: format, major version, cassette id, type and side length, timeline rate,
  write-protect states, safe audio paths present in the archive, `recorded_frames` within the side, and a
  licence file that is not HTML (§6.4).
- Playback cut to exactly `recorded_frames`; the rest of the side is blank tape (§5.5, §7.3).
- Winding that takes time instead of seeking, and stopping at the end of a side (§7.5).
- One tape, two sides: flipping maps the head *p* → *L − p* (§5.4).
- Side and head remembered per `cassette.id`; the file is never modified (§14).
- Track markers for "now playing", with unknown kinds treated as `note` (§7.4).
- Codecs the browser can't decode leave the side unplayable; the cassette still opens (§7.3).

## What it leaves out

Drawing the cassette and J-card (§10–§12), the booklet, rights display, history, recording and tape hiss.
To draw the cassette, start from §10–§12 of the specification and its `geometry/otape-geometry-1.0.json`.

## Browser support

Needs ES modules, private class fields, `DecompressionStream('deflate-raw')` and AAC decoding in
`decodeAudioData`: current Chrome, Edge, Safari and Firefox.

## Licence

The code is released under the [MIT License](../../LICENSE). `examples/sample-tones.otape` and the manifests in
`test/fixtures/manifests/` are copied from [otape-spec](https://github.com/otape-studio/otape-spec) and remain
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) © 2026 Jan Osio.
