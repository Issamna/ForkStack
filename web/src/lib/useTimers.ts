import { useCallback, useEffect, useRef, useState } from "react";

export interface KitchenTimer {
  id: string;
  label: string;
  /** Absolute epoch ms. Storing the end, not a countdown, is what makes the
   *  remaining time correct after the tab is backgrounded -- setInterval is
   *  throttled or stopped there, so a decremented counter drifts badly. */
  endsAt: number;
  total: number;
  done: boolean;
}

/** Short double beep. Synthesised so there's no audio asset to ship or cache. */
function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.45].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.4);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* audio is a nicety; a blocked context must not break the timer */
  }
}

/**
 * Several kitchen timers at once.
 *
 * Deliberately in-app only: the alarm fires while cook mode is open, which the
 * screen wake lock already keeps it. Nothing fires in the background -- that
 * would need notification permission, and on iOS only for an installed app.
 * Because each timer stores its end time, the remaining time is still right
 * when you come back even if the interval stopped running.
 */
export function useTimers() {
  const [timers, setTimers] = useState<KitchenTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const alerted = useRef(new Set<string>());

  useEffect(() => {
    if (!timers.length) return;
    const tick = () => setNow(Date.now());
    const handle = window.setInterval(tick, 500);
    // Recompute the moment the tab is visible again, so a throttled interval
    // never shows a stale clock.
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(handle);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [timers.length]);

  useEffect(() => {
    const finished = timers.filter(
      (t) => !t.done && t.endsAt <= now && !alerted.current.has(t.id),
    );
    if (!finished.length) return;
    finished.forEach((t) => alerted.current.add(t.id));
    beep();
    navigator.vibrate?.([300, 150, 300]);
    setTimers((list) =>
      list.map((t) => (t.endsAt <= now ? { ...t, done: true } : t)),
    );
  }, [now, timers]);

  const start = useCallback((label: string, seconds: number) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    setTimers((list) => [
      ...list,
      { id, label, endsAt: Date.now() + seconds * 1000, total: seconds, done: false },
    ]);
  }, []);

  const dismiss = useCallback((id: string) => {
    alerted.current.delete(id);
    setTimers((list) => list.filter((t) => t.id !== id));
  }, []);

  const remaining = useCallback(
    (t: KitchenTimer) => Math.max(0, (t.endsAt - now) / 1000),
    [now],
  );

  return { timers, start, dismiss, remaining };
}
