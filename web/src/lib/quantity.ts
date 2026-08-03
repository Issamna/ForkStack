/**
 * Client-side quantity scaling for the preview/detail scale controls.
 *
 * Quantities are free-text ("350", "1 1/2", "0.25", "a pinch"). Anything that
 * doesn't parse as a number is returned untouched rather than guessed at --
 * scaling "a pinch" by 2 is worse than leaving it alone.
 */

const FRACTIONS: Record<string, number> = {
  "1/4": 0.25,
  "1/3": 1 / 3,
  "1/2": 0.5,
  "2/3": 2 / 3,
  "3/4": 0.75,
};

function parse(raw: string): number | null {
  const q = raw.trim();
  if (!q) return null;

  // "1 1/2"
  const mixed = q.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);

  // "3/4"
  const frac = q.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const d = Number(frac[2]);
    return d ? Number(frac[1]) / d : null;
  }

  const n = Number(q);
  return Number.isFinite(n) ? n : null;
}

/** Below this, a fraction reads naturally ("1 1/4 tbsp"); above it, absurd. */
const FRACTION_CEILING = 10;

function format(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);

  // Large amounts are weights and volumes -- "437 1/2 g" is nobody's idea of a
  // measurement. Round those to whole units and keep fractions for the small
  // spoon-and-cup quantities they actually suit.
  if (n >= FRACTION_CEILING) return String(Math.round(n));

  const whole = Math.floor(n);
  const rest = n - whole;
  for (const [label, value] of Object.entries(FRACTIONS)) {
    if (Math.abs(rest - value) < 0.02) {
      return whole ? `${whole} ${label}` : label;
    }
  }
  return String(Math.round(n * 100) / 100);
}

export function scaleQuantity(quantity: string, factor: number): string {
  if (factor === 1) return quantity;
  const n = parse(quantity);
  return n === null ? quantity : format(n * factor);
}

/** Loose canonical form for comparing an ingredient to a shopping-list line. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/s$/, "");
}
