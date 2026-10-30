/**
 * The cassette as a player sees it: the manifest with defaults applied,
 * positions converted from frames to seconds, colours parsed, and malformed
 * optional values dropped. It never contains audio or image bytes; those are
 * read on demand through {@link CassetteFile}.
 */

import type {
  ArtworkSlot,
  CassetteType,
  FontRole,
  LabelStyle,
  MarkerKind,
  ShellFinish,
  Side,
  WriteProtect,
} from '../constants.ts';
import type { Issue } from '../issues.ts';
import type { Manifest } from '../manifest/types.ts';
import type { Color } from '../../util/color.ts';

export interface Cassette {
  readonly id: string;
  readonly title: string;
  readonly creator: string;
  readonly description: string;
  readonly serialNumber: string;
  readonly type: CassetteType;
  /** What is printed on the label: `C60`, or `C74` for a custom length (§5.1). */
  readonly typeLabel: string;
  /** Timeline frames per second (§5.3). */
  readonly rate: number;
  /** Length of one side; both sides are equally long. */
  readonly sideSeconds: number;
  readonly sides: Readonly<Record<Side, CassetteSide>>;
  readonly appearance: Appearance;
  readonly jcard: JCard;
  /** Archive paths of the artwork slots that are present and valid. */
  readonly artwork: Readonly<Partial<Record<ArtworkSlot, string>>>;
  readonly rights: Rights | null;
  /** Warnings found while opening. Errors prevent opening altogether. */
  readonly warnings: readonly Issue[];
  /** The manifest as stored in the file, untouched. */
  readonly manifest: Manifest;
}

export interface CassetteSide {
  readonly side: Side;
  readonly title: string;
  readonly writeProtect: WriteProtect;
  /** Recorded length; everything after it is blank tape (§5.5). 0 for a blank side. */
  readonly recordedSeconds: number;
  readonly audio: SideAudio | null;
  /** Track markers sorted by position (§7.4). */
  readonly markers: readonly Marker[];
}

export interface SideAudio {
  readonly path: string;
  readonly codec: string;
  /** Media type to give the browser, or `null` for a codec this version doesn't know. */
  readonly mediaType: string | null;
}

export interface Marker {
  readonly title: string;
  readonly kind: MarkerKind;
  readonly seconds: number;
}

/** §10, with defaults applied. */
export interface Appearance {
  readonly shell: {
    readonly color: Color;
    readonly finish: ShellFinish;
  };
  readonly label: {
    readonly style: LabelStyle;
    readonly paper: Color;
    readonly ink: Color;
    readonly accent: Color;
    readonly font: FontRole;
  };
}

/** §11, with defaults applied. */
export interface JCard {
  readonly cardColor: Color;
  readonly ink: Color;
  readonly font: FontRole;
  readonly title: string;
  readonly subtitle: string;
  readonly spineText: string;
  readonly flapText: string;
  readonly tracklist: Readonly<Record<Side, readonly string[]>>;
  readonly dedication: string;
}

/** §6.4. Information, never DRM. */
export interface Rights {
  readonly copyright: string;
  readonly license: string;
  readonly licenseUrl: string;
  /** Archive path of the full terms, plain text or Markdown. */
  readonly file: string | null;
}
