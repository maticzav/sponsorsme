/**
 * Represents an optional type.
 */
export type Optional<T> = T | null

/**
 * Returns fallback if given value is null or undefined.
 */
export function withdefault<T>(fallback: T, value: T | null | undefined): T {
  if (value === undefined || value === null) return fallback
  return value
}
