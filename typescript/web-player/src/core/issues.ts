/**
 * Everything a reader can find wrong with a file, in one catalogue.
 *
 * A conforming reader rejects an invalid file "naming the reason" (§16.1).
 * Each problem is an {@link Issue} with a stable `code` for programs, the
 * spec `section` it comes from, a readable `message`, and a severity:
 *
 * - `error`: the file breaks a MUST of §16.1 and is rejected;
 * - `warning`: something optional is wrong and is ignored, or a SHOULD is
 *   broken. The cassette still opens.
 *
 * The catalogue is typed: `createIssue('side-length-mismatch', { type, expected })`
 * only compiles with the details that message needs.
 */

export type Severity = 'error' | 'warning';

interface IssueDefinition {
  readonly section: string;
  readonly severity: Severity;
  readonly message: (details: never) => string;
}

const CATALOGUE = {
  /* Container (§3) */
  'not-a-zip': { section: '§3.1', severity: 'error', message: () => 'Not a ZIP archive' },
  'zip-end-not-found': { section: '§3.1', severity: 'error', message: () => 'The ZIP end record is missing' },
  'zip-directory-damaged': {
    section: '§3.1',
    severity: 'error',
    message: () => 'The ZIP directory is damaged',
  },
  'zip-entry-missing': {
    section: '§3.3',
    severity: 'error',
    message: (d: { name: string }) => `${d.name} is not in the archive`,
  },
  'zip-entry-damaged': {
    section: '§3.1',
    severity: 'error',
    message: (d: { name: string }) => `${d.name} has a damaged header`,
  },
  'zip-entry-too-large': {
    section: '§17',
    severity: 'error',
    message: (d: { name: string }) => `${d.name} inflates beyond its declared size`,
  },
  'zip-entry-not-allowed': {
    section: '§3.1',
    severity: 'error',
    message: (d: { name: string; reason: string }) => `${d.name} is ${d.reason}`,
  },
  'mimetype-missing': {
    section: '§3.2',
    severity: 'warning',
    message: () => 'The mimetype entry is missing',
  },
  'mimetype-wrong': {
    section: '§3.2',
    severity: 'warning',
    message: () => 'The mimetype entry should be first, stored, and contain application/vnd.otape.cassette',
  },
  'too-many-entries': {
    section: '§3.5',
    severity: 'warning',
    message: (d: { count: number; max: number }) =>
      `The archive has ${d.count} entries; at most ${d.max} are expected`,
  },

  /* Manifest (§6, §15) */
  'manifest-missing': { section: '§6', severity: 'error', message: () => 'manifest.json is missing' },
  'manifest-too-large': { section: '§3.5', severity: 'error', message: () => 'manifest.json exceeds 1 MiB' },
  'manifest-not-json': { section: '§6', severity: 'error', message: () => 'manifest.json is not valid JSON' },
  'manifest-not-object': {
    section: '§6',
    severity: 'error',
    message: () => 'The manifest must be a JSON object',
  },
  'not-otape': { section: '§6.1', severity: 'error', message: () => 'This is not an oTAPE file' },
  'version-invalid': {
    section: '§15.1',
    severity: 'error',
    message: () => 'format_version must be "MAJOR.MINOR"',
  },
  'version-unsupported': {
    section: '§15.1',
    severity: 'error',
    message: (d: { version: string }) => `oTAPE ${d.version} needs a newer player`,
  },

  /* Cassette (§5, §6.2) */
  'cassette-missing': { section: '§6.2', severity: 'error', message: () => 'The cassette object is missing' },
  'id-invalid': { section: '§5.2', severity: 'error', message: () => 'cassette.id is not a UUID' },
  'created-at-invalid': {
    section: '§5.2',
    severity: 'error',
    message: () => 'cassette.created_at is not an RFC 3339 timestamp',
  },
  'type-unknown': {
    section: '§5.1',
    severity: 'error',
    message: (d: { type: unknown }) => `Unknown cassette type ${JSON.stringify(d.type)}`,
  },
  'side-length-invalid': {
    section: '§5.1',
    severity: 'error',
    message: () => 'side_length_seconds must be an integer',
  },
  'side-length-mismatch': {
    section: '§5.1',
    severity: 'error',
    message: (d: { type: string; expected: number }) => `${d.type} must be ${d.expected} s per side`,
  },
  'custom-length-out-of-range': {
    section: '§5.1',
    severity: 'error',
    message: (d: { min: number; max: number }) => `A custom side must be ${d.min}–${d.max} s`,
  },
  'timeline-rate-invalid': {
    section: '§5.3',
    severity: 'error',
    message: (d: { allowed: readonly number[] }) => `timeline_rate must be one of ${d.allowed.join(', ')}`,
  },
  'serial-number-too-long': {
    section: '§6.2',
    severity: 'warning',
    message: (d: { max: number }) => `serial_number is longer than ${d.max} characters`,
  },
  'rights-file-invalid': {
    section: '§6.4',
    severity: 'error',
    message: () => 'cassette.rights.file must be a .txt or .md file inside the archive',
  },
  'rights-file-missing': {
    section: '§6.4',
    severity: 'warning',
    message: (d: { path: string }) => `The licence file ${d.path} is not in the archive`,
  },

  /* Sides (§7, §8) */
  'sides-missing': { section: '§7', severity: 'error', message: () => 'The sides object is missing' },
  'side-missing': {
    section: '§7.1',
    severity: 'error',
    message: (d: { side: string }) => `Side ${d.side} is missing`,
  },
  'write-protect-invalid': {
    section: '§8.1',
    severity: 'error',
    message: (d: { side: string }) => `Side ${d.side} has an invalid write_protect state`,
  },
  'audio-path-unsafe': {
    section: '§3.3',
    severity: 'error',
    message: (d: { side: string }) => `Side ${d.side} has an unsafe audio path`,
  },
  'audio-file-missing': {
    section: '§16.1',
    severity: 'error',
    message: (d: { side: string; path: string }) => `Side ${d.side}: ${d.path} is not in the archive`,
  },
  'recorded-frames-invalid': {
    section: '§7.2',
    severity: 'error',
    message: (d: { side: string }) => `Side ${d.side}: recorded_frames must be a non-negative integer`,
  },
  'recorded-frames-too-long': {
    section: '§7.2',
    severity: 'error',
    message: (d: { side: string }) => `Side ${d.side} is recorded longer than the tape`,
  },
  'codec-unknown': {
    section: '§7.3',
    severity: 'warning',
    message: (d: { side: string; codec: unknown }) =>
      `Side ${d.side}: unknown codec ${JSON.stringify(d.codec)}; the side may not play`,
  },
  'marker-invalid': {
    section: '§7.4',
    severity: 'warning',
    message: (d: { side: string; index: number }) =>
      `Side ${d.side}: marker ${d.index + 1} is malformed and ignored`,
  },

  /* Appearance and artwork (§10, §12) */
  'color-invalid': {
    section: '§10.2',
    severity: 'warning',
    message: (d: { key: string }) => `${d.key} is not a #RRGGBB or #RRGGBBAA colour; the default is used`,
  },
  'artwork-path-invalid': {
    section: '§12',
    severity: 'warning',
    message: (d: { slot: string }) => `Artwork ${d.slot} is missing or unsafe and is ignored`,
  },
} as const satisfies Record<string, IssueDefinition>;

export type IssueCode = keyof typeof CATALOGUE;

type DetailsOf<C extends IssueCode> = Parameters<(typeof CATALOGUE)[C]['message']>[0];

/** Arguments after the code: the details, when the message needs any. */
type DetailsArgs<C extends IssueCode> = DetailsOf<C> extends undefined ? [] : [details: DetailsOf<C>];

export interface Issue {
  readonly code: IssueCode;
  readonly section: string;
  readonly severity: Severity;
  readonly message: string;
}

export function createIssue<C extends IssueCode>(code: C, ...[details]: DetailsArgs<C>): Issue {
  const definition: IssueDefinition = CATALOGUE[code];
  return {
    code,
    section: definition.section,
    severity: definition.severity,
    message: definition.message(details as never),
  };
}

/** Formats an issue for people: `C60 must be 1800 s per side (§5.1)`. */
export function describeIssue(issue: Issue): string {
  return `${issue.message} (${issue.section})`;
}

/** A file that cannot be opened. `issues` holds every error found, first one first. */
export class OTapeError extends Error {
  override readonly name = 'OTapeError';
  readonly issues: readonly Issue[];

  constructor(issues: readonly Issue[]) {
    const [first] = issues;
    super(first ? describeIssue(first) : 'Invalid oTAPE file');
    this.issues = issues;
  }

  /** Code of the first error. */
  get code(): IssueCode | undefined {
    return this.issues[0]?.code;
  }

  static of<C extends IssueCode>(code: C, ...details: DetailsArgs<C>): OTapeError {
    return new OTapeError([createIssue(code, ...details)]);
  }
}

/** Collects issues while a file is checked. */
export class IssueList {
  readonly #issues: Issue[] = [];

  add<C extends IssueCode>(code: C, ...details: DetailsArgs<C>): void {
    this.#issues.push(createIssue(code, ...details));
  }

  get all(): readonly Issue[] {
    return this.#issues;
  }

  get errors(): readonly Issue[] {
    return this.#issues.filter((issue) => issue.severity === 'error');
  }

  get warnings(): readonly Issue[] {
    return this.#issues.filter((issue) => issue.severity === 'warning');
  }

  get hasErrors(): boolean {
    return this.#issues.some((issue) => issue.severity === 'error');
  }

  /** Throws an {@link OTapeError} with every error collected so far, if there are any. */
  throwIfErrors(): void {
    if (this.hasErrors) throw new OTapeError(this.errors);
  }
}
