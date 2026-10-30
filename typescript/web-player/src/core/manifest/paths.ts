import { MANIFEST_PATH, MIMETYPE_PATH } from '../constants.ts';

const RESERVED_PATHS: readonly string[] = [MANIFEST_PATH, MIMETYPE_PATH];

/**
 * Whether a manifest path is a safe reference to an archive entry (§3.3, §17):
 * relative, `/`-separated, without `.` or `..` segments, and not reserved.
 */
export function isSafePath(path: unknown): path is string {
  if (typeof path !== 'string' || path === '') return false;
  if (path.startsWith('/') || path.includes('\\')) return false;
  if (RESERVED_PATHS.includes(path)) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/** Lowercase extension including the dot, or `''`. */
export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}
