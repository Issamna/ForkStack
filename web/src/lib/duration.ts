const UNIT_SECONDS: Record<string, number> = {
  second: 1, sec: 1, s: 1,
  minute: 60, min: 60, m: 60,
  hour: 3600, hr: 3600, h: 3600,
};

// "20 minutes", "1 hr", "30 secs", "25-30 minutes", "1 hour 30 minutes".
const DURATION = /(\d+)\s*(?:[-–—]\s*\d+\s*)?(seconds?|secs?|minutes?|mins?|hours?|hrs?|[smh])\b/gi;

/**
 * First duration stated in a step, in seconds, or null.
 *
 * A range takes the **lower** bound: "roast for 25-30 minutes" should call you
 * back at 25 so you can look, not at 30 when it may already be too late.
 *
 * Only a seed for the editor's timer field -- most steps say no duration at
 * all ("simmer until reduced"), so this fills in the easy ones and the cook
 * types the rest.
 */
export function parseDuration(text: string): number | null {
  DURATION.lastIndex = 0;
  let total = 0;
  let match: RegExpExecArray | null;
  let lastEnd = -1;

  while ((match = DURATION.exec(text)) !== null) {
    const unit = match[2].toLowerCase().replace(/s$/, "").replace(/^secs?$/, "sec");
    const seconds = UNIT_SECONDS[unit] ?? UNIT_SECONDS[unit.slice(0, 3)] ?? null;
    if (seconds === null) continue;
    const value = Number(match[1]) * seconds;

    // "1 hour 30 minutes" is one duration; a later, unrelated mention is not.
    if (lastEnd >= 0 && match.index - lastEnd > 1) break;
    total += value;
    lastEnd = match.index + match[0].length;
  }
  return total > 0 ? total : null;
}

/** "20 min", "1 h 30 min", "1 min 30 s" -- compact enough for a button. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  // Don't round 90s up to "2 min" -- a timer's label has to be the truth.
  return s ? `${m} min ${s} s` : `${m} min`;
}

/** "09:59" / "1:05:00" -- a running clock. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
