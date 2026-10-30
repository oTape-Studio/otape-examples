/**
 * The shape of `manifest.json` (§6), as written by a conforming writer.
 *
 * These types describe a manifest that has passed validation. Before that,
 * a parsed manifest is `unknown`. Optional keys are optional here too, and
 * unknown keys may be present (§15.2): readers ignore them.
 */

import type { CassetteType, Side, WriteProtect } from '../constants.ts';

/** `#RRGGBB` or `#RRGGBBAA` (§10.2). */
export type ColorString = string;

/** RFC 3339 timestamp. */
export type Timestamp = string;

/** A relative path to an entry of the same archive (§3.3). */
export type ArchivePath = string;

export interface Manifest {
  readonly format: 'oTAPE';
  readonly format_version: string;
  readonly cassette: CassetteInfo;
  readonly sides: Readonly<Record<Side, SideInfo>>;
  readonly appearance?: AppearanceInfo;
  readonly jcard?: JCardInfo;
  readonly artwork?: Readonly<Record<string, ArchivePath>>;
  readonly booklet?: BookletInfo;
  readonly history?: readonly HistoryEvent[];
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export interface CassetteInfo {
  readonly id: string;
  readonly type: CassetteType;
  readonly side_length_seconds: number;
  readonly created_at: Timestamp;
  readonly timeline_rate?: number;
  readonly title?: string;
  readonly creator?: string;
  readonly serial_number?: string;
  readonly description?: string;
  readonly genre?: string;
  readonly notes?: string;
  readonly location?: string;
  readonly date_recorded?: string;
  readonly modified_at?: Timestamp;
  readonly created_with?: string;
  readonly modified_with?: string;
  readonly generation?: number;
  readonly source_cassette_id?: string;
  readonly rights?: RightsInfo;
}

export interface RightsInfo {
  readonly copyright?: string;
  readonly license?: string;
  readonly license_url?: string;
  readonly file?: ArchivePath;
}

export interface SideInfo {
  readonly write_protect: WriteProtect;
  readonly audio?: AudioInfo | null;
  readonly title?: string;
  readonly markers?: readonly MarkerInfo[];
}

export interface AudioInfo {
  readonly file: ArchivePath;
  /** One of `Codec`, or a codec from a later 1.x version. */
  readonly codec: string;
  readonly recorded_frames: number;
  readonly sample_rate?: number;
  readonly channels?: number;
  readonly bit_rate?: number;
  readonly duration_seconds?: number;
}

export interface MarkerInfo {
  readonly frame: number;
  readonly title: string;
  readonly kind?: string;
}

export interface AppearanceInfo {
  readonly preset?: string;
  readonly shell?: {
    readonly color?: ColorString;
    readonly finish?: string;
  };
  readonly label?: {
    readonly style?: string;
    readonly paper?: ColorString;
    readonly ink?: ColorString;
    readonly accent?: ColorString;
    readonly font?: string;
  };
}

export interface JCardInfo {
  readonly card_color?: ColorString;
  readonly ink?: ColorString;
  readonly font?: string;
  readonly front?: { readonly title?: string; readonly subtitle?: string };
  readonly spine?: { readonly text?: string };
  readonly flap?: { readonly text?: string };
  readonly tracklist?: Readonly<Partial<Record<Side, readonly string[]>>>;
  readonly dedication?: string;
}

export interface BookletInfo {
  readonly panels?: readonly ArchivePath[];
  readonly html?: ArchivePath;
  readonly notes?: ArchivePath;
}

export interface HistoryEvent {
  readonly type: string;
  readonly timestamp: Timestamp;
  readonly app?: string;
  readonly side?: Side;
  readonly [key: string]: unknown;
}
