/**
 * Every text the player shows. Replace any of them through the element's
 * `labels` property to reword or translate the player:
 *
 *   player.labels = { play: 'Odtwórz', modes: { ...DEFAULT_LABELS.modes, playing: 'Gra' } };
 */

import type { WriteProtect } from '../core/constants.ts';
import type { Mode } from '../deck/deck.ts';

export interface PlayerLabels {
  readonly play: string;
  readonly stop: string;
  readonly rewind: string;
  readonly fastForward: string;
  readonly flip: string;
  readonly eject: string;
  readonly volume: string;
  readonly counter: string;
  readonly tape: string;
  readonly side: (side: string) => string;
  readonly modes: Readonly<Record<Mode, string>>;
  readonly writeProtect: Readonly<Record<WriteProtect, string>>;
  readonly empty: string;
  readonly emptyDroppable: string;
  readonly chooseFile: string;
  readonly loading: string;
  readonly openFailed: string;
  readonly blankTape: string;
  readonly blankSide: string;
  readonly unplayable: string;
  readonly playbackFailed: string;
  readonly untitled: string;
  readonly remaining: (time: string) => string;
  readonly recorded: (time: string) => string;
  readonly about: string;
  readonly markers: string;
  readonly windTo: (title: string) => string;
  readonly rights: string;
  readonly showLicense: string;
  readonly warnings: string;
}

export const DEFAULT_LABELS: PlayerLabels = {
  play: 'Play',
  stop: 'Stop',
  rewind: 'Rewind',
  fastForward: 'Fast forward',
  flip: 'Flip the cassette',
  eject: 'Eject',
  volume: 'Volume',
  counter: 'Tape counter',
  tape: 'Tape position',
  side: (side) => `Side ${side}`,
  modes: {
    stopped: 'Stop',
    playing: 'Play',
    'fast-forward': 'Fast forward',
    rewinding: 'Rewind',
  },
  writeProtect: {
    intact: 'Recordable',
    broken: 'Write-protected',
    taped_over: 'Tab taped over',
  },
  empty: 'No cassette',
  emptyDroppable: 'Drop an .otape cassette here',
  chooseFile: 'Choose a file',
  loading: 'Reading the cassette…',
  openFailed: 'This cassette could not be opened',
  blankTape: 'Blank tape',
  blankSide: 'Blank side',
  unplayable: 'This browser cannot play the audio of this side',
  playbackFailed: 'Playback could not start',
  untitled: 'Untitled cassette',
  remaining: (time) => `−${time}`,
  recorded: (time) => `${time} recorded`,
  about: 'About this cassette',
  markers: 'On this side',
  windTo: (title) => `Wind to ${title}`,
  rights: 'Rights',
  showLicense: 'Show licence',
  warnings: 'Notes on this file',
};
