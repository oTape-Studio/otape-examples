/**
 * Simplest oTAPE 1.0 player: public API.
 *
 *   import { Player } from './src/index.js';
 *
 *   const player = new Player();
 *   await player.load(await file.arrayBuffer());
 *   player.play();
 *
 * @module otape-player
 */

export { Player } from './player.js';
export { openCassette, describeCassette, markerAt, typeLabel } from './cassette.js';
export { parseManifest, validateManifest, isSafePath } from './manifest.js';
export { ZipArchive } from './zip-archive.js';
export { TapeHead } from './tape-head.js';
export { AudioOutput } from './audio-output.js';
export { PositionStore } from './position-store.js';
export { OTapeError, ErrorCode } from './errors.js';
export { formatTime, framesToSeconds, secondsToFrames } from './time.js';
export {
  CassetteType,
  Codec,
  MarkerKind,
  MIMETYPE,
  Mode,
  PlayerEvent,
  Side,
  WriteProtect,
} from './constants.js';
