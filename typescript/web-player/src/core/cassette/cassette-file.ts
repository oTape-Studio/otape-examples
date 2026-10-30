/**
 * An opened .otape file: the cassette model plus lazy access to its audio,
 * images and documents.
 *
 * Opening follows Appendix C. Only the ZIP directory and the manifest are
 * read up front; everything else is read when asked for.
 */

import {
  IMAGE_MEDIA_TYPES,
  Limits,
  MANIFEST_PATH,
  MEDIA_TYPE,
  MIMETYPE_PATH,
  type ArtworkSlot,
  type Side,
} from '../constants.ts';
import { IssueList, OTapeError } from '../issues.ts';
import { extensionOf } from '../manifest/paths.ts';
import { validateManifest } from '../manifest/validate.ts';
import { CompressionMethod, entryRestriction, ZipReader } from '../zip/zip-reader.ts';
import { describeCassette } from './describe.ts';
import type { Cassette } from './model.ts';

export class CassetteFile {
  readonly cassette: Cassette;
  readonly #zip: ZipReader;

  private constructor(cassette: Cassette, zip: ZipReader) {
    this.cassette = cassette;
    this.#zip = zip;
  }

  /**
   * Open a cassette from a File or Blob.
   *
   * @throws {OTapeError} listing every error, if the file is not a valid cassette
   */
  static async open(source: Blob): Promise<CassetteFile> {
    const zip = await ZipReader.open(source);
    const issues = new IssueList();

    await checkContainer(zip, issues);
    const manifest = validateManifest(await readManifest(zip), zip, issues);
    issues.throwIfErrors();
    if (!manifest) throw new OTapeError(issues.errors);

    const cassette = describeCassette(manifest, (path) => zip.has(path), issues.warnings);
    return new CassetteFile(cassette, zip);
  }

  /**
   * Open a cassette from a URL. The whole file is downloaded first.
   *
   * @throws {OTapeError} if the file is not a valid cassette
   * @throws {TypeError} if it can't be fetched
   */
  static async fetch(url: string | URL, init?: RequestInit): Promise<CassetteFile> {
    const response = await fetch(url, init);
    if (!response.ok)
      throw new TypeError(`Could not fetch ${String(url)}: ${response.status} ${response.statusText}`);
    return CassetteFile.open(await response.blob());
  }

  /**
   * The audio of a side, typed for the browser, or `null` for a blank side.
   * A stored entry is a slice of the file and is not loaded into memory.
   */
  async audio(side: Side): Promise<Blob | null> {
    const audio = this.cassette.sides[side].audio;
    return audio ? this.#zip.blob(audio.path, audio.mediaType ?? '') : null;
  }

  /** The image in an artwork slot, or `null` if there is none (§12). */
  async artwork(slot: ArtworkSlot): Promise<Blob | null> {
    const path = this.cassette.artwork[slot];
    if (path === undefined) return null;
    return this.#zip.blob(path, IMAGE_MEDIA_TYPES[extensionOf(path)] ?? '');
  }

  /** The full licence text, if the cassette has one (§6.4). Plain text or Markdown, never HTML. */
  async licenseText(): Promise<string | null> {
    const file = this.cassette.rights?.file;
    return file != null && this.#zip.has(file) ? this.#zip.text(file) : null;
  }
}

/** Container checks (§3). Problems with the mimetype entry are only warnings (§3.2). */
async function checkContainer(zip: ZipReader, issues: IssueList): Promise<void> {
  for (const entry of zip.entries.values()) {
    const reason = entryRestriction(entry);
    if (reason) issues.add('zip-entry-not-allowed', { name: entry.name, reason });
  }

  if (zip.entries.size > Limits.ARCHIVE_ENTRIES) {
    issues.add('too-many-entries', { count: zip.entries.size, max: Limits.ARCHIVE_ENTRIES });
  }

  if (!zip.has(MIMETYPE_PATH)) {
    issues.add('mimetype-missing');
    return;
  }
  const mimetype = zip.entry(MIMETYPE_PATH);
  const wellFormed =
    zip.firstEntry === mimetype &&
    mimetype.method === CompressionMethod.Stored &&
    (await zip.localExtraLength(MIMETYPE_PATH)) === 0 &&
    (await zip.text(MIMETYPE_PATH)) === MEDIA_TYPE;
  if (!wellFormed) issues.add('mimetype-wrong');
}

async function readManifest(zip: ZipReader): Promise<unknown> {
  if (!zip.has(MANIFEST_PATH)) throw OTapeError.of('manifest-missing');
  // Check the declared size before inflating anything (§3.5, §17).
  if (zip.entry(MANIFEST_PATH).size > Limits.MANIFEST_BYTES) throw OTapeError.of('manifest-too-large');
  try {
    return JSON.parse(await zip.text(MANIFEST_PATH)) as unknown;
  } catch (error) {
    if (error instanceof OTapeError) throw error;
    throw OTapeError.of('manifest-not-json');
  }
}
