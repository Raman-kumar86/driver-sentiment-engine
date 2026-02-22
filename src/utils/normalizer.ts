/**
 * Normalizes an entity ID so that logically equivalent IDs are treated as
 * the same entity across the entire system.
 *
 * Rules:
 *  - Trim surrounding whitespace
 *  - Pure-digit IDs: strip leading zeros by parsing as an integer
 *      "001" → "1"  |  "01" → "1"  |  "1" → "1"
 *  - Alphanumeric IDs: uppercase the string unchanged
 *      "d001" → "D001"  |  "DRV42" → "DRV42"
 *
 * @param id Raw entity ID received from the client or any external source.
 * @returns Canonical, normalized entity ID string.
 */
export function normalizeEntityId(id: string): string {
  const trimmed = id.trim();

  // Pure-digit: remove leading zeros
  if (/^\d+$/.test(trimmed)) {
    return String(parseInt(trimmed, 10));
  }

  // Alphanumeric (or anything else): uppercase
  return trimmed.toUpperCase();
}
