/**
 * Where each cassette was left: its side and head position (§14).
 *
 * This is player state, never cassette state: playing a cassette MUST NOT
 * modify the file. Positions are kept per `cassette.id`, so a tape resumes
 * where it was even under another file name, and are stored in timeline
 * frames, the unit the specification uses for positions.
 */

import { SIDES, type Side } from '../core/constants.ts';
import { isNonNegativeInteger, isObject } from '../util/guards.ts';

export interface SavedPosition {
  readonly side: Side;
  readonly frame: number;
}

export interface PositionStore {
  load(cassetteId: string): SavedPosition | null;
  save(cassetteId: string, position: SavedPosition): void;
}

const KEY_PREFIX = 'otape:position:';

/** Keeps positions in Web Storage. Fails silently when storage is unavailable. */
export class WebStoragePositionStore implements PositionStore {
  readonly #storage: Storage | null;

  constructor(storage: Storage | null = defaultStorage()) {
    this.#storage = storage;
  }

  load(cassetteId: string): SavedPosition | null {
    try {
      const value: unknown = JSON.parse(this.#storage?.getItem(KEY_PREFIX + cassetteId) ?? 'null');
      return isSavedPosition(value) ? value : null;
    } catch {
      return null;
    }
  }

  save(cassetteId: string, position: SavedPosition): void {
    try {
      this.#storage?.setItem(KEY_PREFIX + cassetteId, JSON.stringify(position));
    } catch {
      // Full or blocked storage: forgetting a position is harmless.
    }
  }
}

/** Keeps positions for the lifetime of the page only. */
export class MemoryPositionStore implements PositionStore {
  readonly #positions = new Map<string, SavedPosition>();

  load(cassetteId: string): SavedPosition | null {
    return this.#positions.get(cassetteId) ?? null;
  }

  save(cassetteId: string, position: SavedPosition): void {
    this.#positions.set(cassetteId, position);
  }
}

/** Merely touching `localStorage` throws when site data is blocked. */
function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function isSavedPosition(value: unknown): value is SavedPosition {
  return isObject(value) && SIDES.includes(value['side'] as Side) && isNonNegativeInteger(value['frame']);
}
