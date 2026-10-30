/**
 * oTAPE web player: public API.
 *
 * Three layers, usable on their own:
 *
 * - core     open and validate .otape files, no DOM needed
 * - deck     tape transport with streaming playback
 * - render   SVG drawings of the cassette and J-card
 *
 * and the <otape-player> custom element that puts them together.
 */

// Core
export { CassetteFile } from './core/cassette/cassette-file.ts';
export { describeCassette, typeLabel } from './core/cassette/describe.ts';
export type {
  Appearance,
  Cassette,
  CassetteSide,
  JCard,
  Marker,
  Rights,
  SideAudio,
} from './core/cassette/model.ts';
export * from './core/constants.ts';
export { createIssue, describeIssue, IssueList, OTapeError } from './core/issues.ts';
export type { Issue, IssueCode, Severity } from './core/issues.ts';
export { isSafePath } from './core/manifest/paths.ts';
export type * from './core/manifest/types.ts';
export { validateManifest, type EntryLookup } from './core/manifest/validate.ts';
export { ZipReader, type ZipEntry } from './core/zip/zip-reader.ts';

// Deck
export { Deck, DeckError, DeckErrorCode, DEFAULT_WIND_SPEED, Mode } from './deck/deck.ts';
export type { DeckEvents, DeckOptions } from './deck/deck.ts';
export { AudioElementOutput, type PlaybackOutput } from './deck/playback-output.ts';
export {
  MemoryPositionStore,
  WebStoragePositionStore,
  type PositionStore,
  type SavedPosition,
} from './deck/position-store.ts';
export { ReelModel, type ReelState } from './deck/reel-model.ts';
export { TapeHead, type Clock } from './deck/tape-head.ts';

// Render
export { CassetteView, type CassetteArtworkUrls } from './render/cassette-view.ts';
export { JCardView } from './render/jcard-view.ts';
export { FONT_ROLES, FONT_STYLESHEET_URL, type FontFace } from './render/fonts.ts';

// Element
export {
  defineOTapePlayer,
  OTapePlayerElement,
  type OTapePlayerEventMap,
} from './element/otape-player-element.ts';
export { DEFAULT_LABELS, type PlayerLabels } from './element/labels.ts';

// Utilities
export { formatTime, framesToSeconds, secondsToFrames } from './util/time.ts';
export { parseColor, type Color } from './util/color.ts';
