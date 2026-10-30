/** Type guards for data parsed from JSON. */

export type JsonObject = Readonly<Record<string, unknown>>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

/** Whether `value` is one of the values of an `as const` enum object. */
export function isOneOf<T extends string>(values: Readonly<Record<string, T>>, value: unknown): value is T {
  return Object.values(values).includes(value as T);
}
