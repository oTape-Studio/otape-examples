/**
 * Validation of `manifest.json` (§16.1, Appendix C).
 *
 * Every problem is collected rather than thrown at the first one, so a
 * validator can show them all. Breaking a MUST of §16.1 is an error; a
 * malformed optional value is a warning and is ignored by the model.
 */

import {
  ArtworkSlot,
  CassetteType,
  Codec,
  CUSTOM_SIDE_SECONDS,
  DEFAULT_TIMELINE_RATE,
  FORMAT_NAME,
  Limits,
  RIGHTS_FILE_EXTENSIONS,
  SIDES,
  STANDARD_SIDE_SECONDS,
  SUPPORTED_MAJOR_VERSION,
  TIMELINE_RATES,
  WriteProtect,
  type Side,
} from '../constants.ts';
import type { IssueList } from '../issues.ts';
import { isNonNegativeInteger, isObject, isOneOf, isString, type JsonObject } from '../../util/guards.ts';
import { isColor } from '../../util/color.ts';
import { extensionOf, isSafePath } from './paths.ts';
import type { Manifest } from './types.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RFC3339 = /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;
const VERSION = /^(\d+)\.(\d+)$/;

/** What validation needs to know about the archive. */
export interface EntryLookup {
  has(path: string): boolean;
}

/**
 * Validate a parsed manifest. Returns it typed as a {@link Manifest} if it has
 * no errors, `null` otherwise. Every problem is added to `issues`.
 */
export function validateManifest(value: unknown, archive: EntryLookup, issues: IssueList): Manifest | null {
  if (!isObject(value)) {
    issues.add('manifest-not-object');
    return null;
  }
  if (value['format'] !== FORMAT_NAME) {
    issues.add('not-otape');
    return null;
  }
  if (!validateVersion(value['format_version'], issues)) return null;

  const sideFrames = validateCassette(value['cassette'], archive, issues);
  validateSides(value['sides'], sideFrames, archive, issues);
  validateAppearance(value['appearance'], issues);
  validateJCard(value['jcard'], issues);
  validateArtwork(value['artwork'], archive, issues);

  return issues.hasErrors ? null : (value as unknown as Manifest);
}

/** Major versions other than 1 may mean something else and are refused (§15.1). */
function validateVersion(version: unknown, issues: IssueList): boolean {
  const match = isString(version) ? VERSION.exec(version) : null;
  if (!match) {
    issues.add('version-invalid');
    return false;
  }
  if (Number(match[1]) !== SUPPORTED_MAJOR_VERSION) {
    issues.add('version-unsupported', { version: version as string });
    return false;
  }
  return true;
}

/** @returns the side length in frames, or `null` if it can't be known */
function validateCassette(cassette: unknown, archive: EntryLookup, issues: IssueList): number | null {
  if (!isObject(cassette)) {
    issues.add('cassette-missing');
    return null;
  }
  if (!isString(cassette['id']) || !UUID.test(cassette['id'])) issues.add('id-invalid');
  if (!isString(cassette['created_at']) || !RFC3339.test(cassette['created_at']))
    issues.add('created-at-invalid');

  const serial = cassette['serial_number'];
  if (isString(serial) && characterCount(serial) > Limits.SERIAL_NUMBER_LENGTH) {
    issues.add('serial-number-too-long', { max: Limits.SERIAL_NUMBER_LENGTH });
  }

  validateRights(cassette['rights'], archive, issues);

  const rate = cassette['timeline_rate'] ?? DEFAULT_TIMELINE_RATE;
  const rateValid = TIMELINE_RATES.includes(rate as number);
  if (!rateValid) issues.add('timeline-rate-invalid', { allowed: TIMELINE_RATES });

  const seconds = validateSideLength(cassette['type'], cassette['side_length_seconds'], issues);
  return seconds !== null && rateValid ? seconds * (rate as number) : null;
}

/** The type fixes the side length; a mismatch MUST be rejected (§5.1). */
function validateSideLength(type: unknown, seconds: unknown, issues: IssueList): number | null {
  if (!Number.isInteger(seconds)) {
    issues.add('side-length-invalid');
    return null;
  }
  const length = seconds as number;

  if (type === CassetteType.Custom) {
    const { min, max } = CUSTOM_SIDE_SECONDS;
    if (length >= min && length <= max) return length;
    issues.add('custom-length-out-of-range', { min, max });
    return null;
  }

  if (isOneOf(CassetteType, type)) {
    const expected = STANDARD_SIDE_SECONDS[type as keyof typeof STANDARD_SIDE_SECONDS];
    if (length === expected) return length;
    issues.add('side-length-mismatch', { type, expected });
    return null;
  }

  issues.add('type-unknown', { type });
  return null;
}

/** The licence file is shown to users, so it must never be HTML (§6.4, §17). */
function validateRights(rights: unknown, archive: EntryLookup, issues: IssueList): void {
  if (!isObject(rights) || rights['file'] === undefined) return;
  const file = rights['file'];
  if (!isSafePath(file) || !RIGHTS_FILE_EXTENSIONS.includes(extensionOf(file))) {
    issues.add('rights-file-invalid');
  } else if (!archive.has(file)) {
    issues.add('rights-file-missing', { path: file });
  }
}

function validateSides(
  sides: unknown,
  sideFrames: number | null,
  archive: EntryLookup,
  issues: IssueList,
): void {
  if (!isObject(sides)) {
    issues.add('sides-missing');
    return;
  }
  for (const side of SIDES) {
    const data = sides[side];
    if (isObject(data)) validateSide(side, data, sideFrames, archive, issues);
    else issues.add('side-missing', { side });
  }
}

function validateSide(
  side: Side,
  data: JsonObject,
  sideFrames: number | null,
  archive: EntryLookup,
  issues: IssueList,
): void {
  if (!isOneOf(WriteProtect, data['write_protect'])) issues.add('write-protect-invalid', { side });
  validateMarkers(side, data['markers'], issues);

  // A missing `audio`, `null`, or zero recorded frames all mean a blank side (§7.1, §7.2).
  const audio = data['audio'];
  if (audio == null || (isObject(audio) && audio['recorded_frames'] === 0)) return;
  if (!isObject(audio)) {
    issues.add('audio-path-unsafe', { side });
    return;
  }

  const file = audio['file'];
  if (!isSafePath(file)) issues.add('audio-path-unsafe', { side });
  else if (!archive.has(file)) issues.add('audio-file-missing', { side, path: file });

  const frames = audio['recorded_frames'];
  if (!isNonNegativeInteger(frames)) issues.add('recorded-frames-invalid', { side });
  else if (sideFrames !== null && frames > sideFrames) issues.add('recorded-frames-too-long', { side });

  if (!isOneOf(Codec, audio['codec'])) issues.add('codec-unknown', { side, codec: audio['codec'] });
}

/** Markers are informative, so a malformed one is ignored, not fatal (§7.4). */
function validateMarkers(side: Side, markers: unknown, issues: IssueList): void {
  if (!Array.isArray(markers)) return;
  markers.forEach((marker: unknown, index) => {
    const valid = isObject(marker) && isNonNegativeInteger(marker['frame']) && isString(marker['title']);
    if (!valid) issues.add('marker-invalid', { side, index });
  });
}

function validateAppearance(appearance: unknown, issues: IssueList): void {
  if (!isObject(appearance)) return;
  validateColors('appearance.shell', appearance['shell'], ['color'], issues);
  validateColors('appearance.label', appearance['label'], ['paper', 'ink', 'accent'], issues);
}

function validateJCard(jcard: unknown, issues: IssueList): void {
  validateColors('jcard', jcard, ['card_color', 'ink'], issues);
}

function validateColors(prefix: string, owner: unknown, keys: readonly string[], issues: IssueList): void {
  if (!isObject(owner)) return;
  for (const key of keys) {
    const value = owner[key];
    if (value !== undefined && !isColor(value)) issues.add('color-invalid', { key: `${prefix}.${key}` });
  }
}

/** Images are optional: a bad slot is ignored and drawn procedurally (§12.1). */
function validateArtwork(artwork: unknown, archive: EntryLookup, issues: IssueList): void {
  if (!isObject(artwork)) return;
  for (const slot of Object.values(ArtworkSlot)) {
    const path = artwork[slot];
    if (path === undefined) continue;
    if (!isSafePath(path) || !archive.has(path)) issues.add('artwork-path-invalid', { slot });
  }
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Characters as people count them: an emoji or an accented letter is one. */
function characterCount(text: string): number {
  return Array.from(graphemes.segment(text)).length;
}
