/**
 * Turns a validated manifest into the {@link Cassette} model.
 *
 * Pure functions: no archive, no I/O. Anything optional that is malformed
 * falls back to the default of the specification, as the reader rules
 * require (§10.1, §10.3, §10.5, §11.1, §15.2).
 */

import {
  ArtworkSlot,
  CassetteType,
  CODEC_MEDIA_TYPES,
  Codec,
  DEFAULT_TIMELINE_RATE,
  Defaults,
  FontRole,
  LabelStyle,
  MarkerKind,
  ShellFinish,
  SIDES,
  type Side,
} from '../constants.ts';
import type { Issue } from '../issues.ts';
import type {
  AppearanceInfo,
  JCardInfo,
  Manifest,
  MarkerInfo,
  RightsInfo,
  SideInfo,
} from '../manifest/types.ts';
import { isSafePath } from '../manifest/paths.ts';
import { isNonNegativeInteger, isObject, isOneOf, isString } from '../../util/guards.ts';
import { parseColor } from '../../util/color.ts';
import { framesToSeconds } from '../../util/time.ts';
import type { Appearance, Cassette, CassetteSide, JCard, Marker, Rights, SideAudio } from './model.ts';

export function describeCassette(
  manifest: Manifest,
  hasEntry: (path: string) => boolean,
  warnings: readonly Issue[] = [],
): Cassette {
  const info = manifest.cassette;
  const rate = info.timeline_rate ?? DEFAULT_TIMELINE_RATE;
  const title = info.title ?? '';

  return {
    id: info.id,
    title,
    creator: info.creator ?? '',
    description: info.description ?? '',
    serialNumber: info.serial_number ?? '',
    type: info.type,
    typeLabel: typeLabel(info.type, info.side_length_seconds),
    rate,
    sideSeconds: info.side_length_seconds,
    sides: mapSides((side) => describeSide(side, manifest.sides[side], rate)),
    appearance: describeAppearance(manifest.appearance),
    jcard: describeJCard(manifest.jcard, title),
    artwork: describeArtwork(manifest.artwork, hasEntry),
    rights: describeRights(info.rights),
    warnings,
    manifest,
  };
}

/** A custom cassette is named after its total length in minutes: 37 min per side is C74 (§5.1). */
export function typeLabel(type: CassetteType, sideSeconds: number): string {
  return type === CassetteType.Custom ? `C${Math.round((2 * sideSeconds) / 60)}` : type;
}

function describeSide(side: Side, info: SideInfo, rate: number): CassetteSide {
  const recorded = info.audio != null && info.audio.recorded_frames > 0;
  return {
    side,
    title: info.title ?? '',
    writeProtect: info.write_protect,
    recordedSeconds: recorded ? framesToSeconds(info.audio.recorded_frames, rate) : 0,
    audio: recorded ? describeAudio(info.audio.file, info.audio.codec) : null,
    markers: describeMarkers(info.markers, rate),
  };
}

function describeAudio(path: string, codec: string): SideAudio {
  return { path, codec, mediaType: isOneOf(Codec, codec) ? CODEC_MEDIA_TYPES[codec] : null };
}

function describeMarkers(markers: readonly MarkerInfo[] | undefined, rate: number): Marker[] {
  if (!Array.isArray(markers)) return [];
  return markers
    .filter(isWellFormedMarker)
    .map((marker) => ({
      title: marker.title,
      kind: markerKind(marker.kind),
      seconds: framesToSeconds(marker.frame, rate),
    }))
    .sort((a, b) => a.seconds - b.seconds);
}

/** Malformed markers are ignored; validation has already warned about them (§7.4). */
function isWellFormedMarker(marker: unknown): marker is MarkerInfo {
  return isObject(marker) && isNonNegativeInteger(marker['frame']) && isString(marker['title']);
}

/** A missing kind means `track`; an unknown kind is treated as `note` (§7.4). */
function markerKind(kind: unknown): MarkerKind {
  if (kind === undefined) return Defaults.markerKind;
  return isOneOf(MarkerKind, kind) ? kind : Defaults.unknownMarkerKind;
}

function describeAppearance(info: AppearanceInfo | undefined): Appearance {
  const shell = info?.shell;
  const label = info?.label;
  return {
    shell: {
      color: parseColor(shell?.color, Defaults.shellColor),
      finish: isOneOf(ShellFinish, shell?.finish) ? shell.finish : Defaults.shellFinish,
    },
    label: {
      style: labelStyle(label?.style),
      paper: parseColor(label?.paper, Defaults.labelPaper),
      ink: parseColor(label?.ink, Defaults.labelInk),
      accent: parseColor(label?.accent, Defaults.labelAccent),
      font: fontRole(label?.font, Defaults.labelFont),
    },
  };
}

/** Unknown styles are drawn as plain (§10.3). */
function labelStyle(style: unknown): LabelStyle {
  if (style === undefined) return Defaults.labelStyle;
  return isOneOf(LabelStyle, style) ? style : Defaults.unknownLabelStyle;
}

/** Unknown roles are drawn as sans (§10.5). */
function fontRole(role: unknown, fallback: FontRole): FontRole {
  if (role === undefined) return fallback;
  return isOneOf(FontRole, role) ? role : Defaults.unknownFontRole;
}

function describeJCard(info: JCardInfo | undefined, cassetteTitle: string): JCard {
  const title = info?.front?.title ?? cassetteTitle;
  return {
    cardColor: parseColor(info?.card_color, Defaults.cardColor),
    ink: parseColor(info?.ink, Defaults.cardInk),
    font: fontRole(info?.font, Defaults.cardFont),
    title,
    subtitle: info?.front?.subtitle ?? '',
    spineText: info?.spine?.text ?? title.toUpperCase(),
    flapText: info?.flap?.text ?? '',
    tracklist: mapSides((side) => (info?.tracklist?.[side] ?? []).filter(isString)),
    dedication: info?.dedication ?? '',
  };
}

function describeArtwork(
  artwork: Manifest['artwork'],
  hasEntry: (path: string) => boolean,
): Partial<Record<ArtworkSlot, string>> {
  const result: Partial<Record<ArtworkSlot, string>> = {};
  for (const slot of Object.values(ArtworkSlot)) {
    const path = artwork?.[slot];
    if (isSafePath(path) && hasEntry(path)) result[slot] = path;
  }
  return result;
}

function describeRights(rights: RightsInfo | undefined): Rights | null {
  if (!rights) return null;
  return {
    copyright: rights.copyright ?? '',
    license: rights.license ?? '',
    licenseUrl: rights.license_url ?? '',
    file: rights.file ?? null,
  };
}

function mapSides<T>(build: (side: Side) => T): Record<Side, T> {
  return Object.fromEntries(SIDES.map((side) => [side, build(side)])) as Record<Side, T>;
}
