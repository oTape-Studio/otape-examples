/**
 * Where each cassette was left: its side and head position (§14).
 *
 * This is player state, not cassette state: playing a cassette MUST NOT
 * modify the file. Positions are kept per `cassette.id`, so a tape resumes
 * where it was even under another file name, and are stored as timeline
 * frames, the unit the specification uses for positions.
 *
 * @module position-store
 */

import { SIDES } from './constants.js';

const KEY_PREFIX = 'otape:position:';

/**
 * @typedef {object} SavedPosition
 * @property {string} side   'A' or 'B'
 * @property {number} frame  head position on the timeline
 */

export class PositionStore {
  /** @type {Storage | null} */
  #storage;

  /**
   * @param {Storage | null} [storage]  defaults to localStorage when available
   */
  constructor(storage = defaultStorage()) {
    this.#storage = storage;
  }

  /**
   * @param {string} cassetteId
   * @returns {SavedPosition | null}
   */
  load(cassetteId) {
    try {
      const value = JSON.parse(this.#storage?.getItem(KEY_PREFIX + cassetteId) ?? 'null');
      return isSavedPosition(value) ? value : null;
    } catch {
      return null;   // storage blocked, or damaged value
    }
  }

  /**
   * @param {string} cassetteId
   * @param {SavedPosition} position
   */
  save(cassetteId, position) {
    try {
      this.#storage?.setItem(KEY_PREFIX + cassetteId, JSON.stringify(position));
    } catch {
      // Storage full or blocked: forgetting a position is harmless.
    }
  }
}

/** Accessing localStorage itself throws when site data is blocked. */
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isSavedPosition(value) {
  return SIDES.includes(value?.side) && Number.isInteger(value.frame) && value.frame >= 0;
}
