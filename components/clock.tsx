"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { saveScore } from "@/lib/actions";
import {
  clockFace,
  OPEN_CLOCK,
  PRESTART_SEC,
  prestartCues,
  prestartSecond,
  splitElapsed,
  type ClockPlan,
  type ClockWorkout,
} from "@/lib/clock";

type ClockContextValue = {
  workout: ClockWorkout | null;
  selectedId: number | null;
  startedAt: number | null;
  countdownUntil: number | null;
  now: number;
  armedUntil: number;
  register: (next: ClockWorkout | null) => void;
  tap: () => void;
  cycle: () => void;
  cancel: () => void;
};

const ClockContext = createContext<ClockContextValue | null>(null);

export function ClockProvider({ children }: { children: React.ReactNode }) {
  const [workout, setWorkout] = useState<ClockWorkout | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [countdownUntil, setCountdownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [armedUntil, setArmedUntil] = useState(0);
  const runningRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const countdownUntilRef = useRef<number | null>(null);
  const announcedRef = useRef(PRESTART_SEC);
  const armedUntilRef = useRef(0);
  const workoutRef = useRef<ClockWorkout | null>(null);
  const selectedIdRef = useRef<number | null>(null);

  useEffect(() => {
    startedAtRef.current = startedAt;
    countdownUntilRef.current = countdownUntil;
    armedUntilRef.current = armedUntil;
    workoutRef.current = workout;
    selectedIdRef.current = selectedId;
  }, [startedAt, countdownUntil, armedUntil, workout, selectedId]);

  const register = useCallback((next: ClockWorkout | null) => {
    if (runningRef.current) return;
    setWorkout(next);
    setSelectedId((current) => {
      if (next && current != null && next.parts.some((part) => part.id === current)) return current;
      return next?.defaultId ?? null;
    });
  }, []);

  const start = useCallback(() => {
    unlockAudio();
    runningRef.current = true;
    const stamp = Date.now();
    startedAtRef.current = stamp;
    armedUntilRef.current = 0;
    setStartedAt(stamp);
    setNow(stamp);
    setArmedUntil(0);
  }, []);

  const cancel = useCallback(() => {
    if (countdownUntilRef.current == null) return;
    countdownUntilRef.current = null;
    announcedRef.current = PRESTART_SEC;
    setCountdownUntil(null);
  }, []);

  const beginCountdown = useCallback(() => {
    unlockAudio();
    announcedRef.current = PRESTART_SEC;
    const stamp = Date.now();
    const until = stamp + PRESTART_SEC * 1000;
    countdownUntilRef.current = until;
    setCountdownUntil(until);
    setNow(stamp);
  }, []);

  const stop = useCallback(async () => {
    const started = startedAtRef.current;
    const current = workoutRef.current;
    const selected = selectedIdRef.current;
    const option = current?.parts.find((part) => part.id === selected) ?? current?.parts[0];
    runningRef.current = false;
    startedAtRef.current = null;
    countdownUntilRef.current = null;
    announcedRef.current = PRESTART_SEC;
    armedUntilRef.current = 0;
    setStartedAt(null);
    setCountdownUntil(null);
    setArmedUntil(0);
    if (!started || !current || !option?.plan.savesTime) return;
    const elapsed = splitElapsed((Date.now() - started) / 1000);
    if (!elapsed) return;
    const form = new FormData();
    form.set("partId", String(option.id));
    form.set("athlete", current.athlete);
    form.set("scoreType", "time");
    form.set("minutes", String(elapsed.minutes));
    form.set("seconds", String(elapsed.seconds));
    form.set("unit", "lb");
    try {
      await saveScore(form);
    } catch {
      // The clock is stopped. The score form is still on the page.
    }
  }, []);

  const tap = useCallback(() => {
    if (countdownUntilRef.current != null) {
      cancel();
      return;
    }
    if (!runningRef.current) {
      beginCountdown();
      return;
    }
    if (armedUntilRef.current > Date.now()) {
      void stop();
      return;
    }
    const until = Date.now() + 2000;
    armedUntilRef.current = until;
    setArmedUntil(until);
    setNow(Date.now());
  }, [beginCountdown, cancel, stop]);

  const cycle = useCallback(() => {
    if (runningRef.current || countdownUntilRef.current != null) return;
    setSelectedId((current) => {
      const parts = workoutRef.current?.parts ?? [];
      if (parts.length < 2) return current;
      const index = parts.findIndex((part) => part.id === current);
      return parts[(index + 1) % parts.length]?.id ?? current;
    });
  }, []);

  useEffect(() => {
    if (startedAt == null && countdownUntil == null) return;
    const id = window.setInterval(() => {
      const stamp = Date.now();
      const until = countdownUntilRef.current;
      if (until != null && !runningRef.current) {
        const second = prestartSecond(Math.max(0, (until - stamp) / 1000));
        const cues = prestartCues(announcedRef.current, second);
        announcedRef.current = second;
        for (const cue of cues) {
          if (cue === "go") goBeep();
          else beep();
        }
        if (stamp >= until) {
          countdownUntilRef.current = null;
          setCountdownUntil(null);
          start();
        }
      }
      setNow(stamp);
    }, 200);
    return () => window.clearInterval(id);
  }, [startedAt, countdownUntil, start]);

  const holding = startedAt != null || countdownUntil != null;

  useEffect(() => {
    if (!holding || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    navigator.wakeLock
      .request("screen")
      .then((sentinel) => {
        if (cancelled) void sentinel.release();
        else lock = sentinel;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void lock?.release();
    };
  }, [holding]);

  const value = useMemo(
    () => ({ workout, selectedId, startedAt, countdownUntil, now, armedUntil, register, tap, cycle, cancel }),
    [workout, selectedId, startedAt, countdownUntil, now, armedUntil, register, tap, cycle, cancel],
  );

  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>;
}

export function useClock() {
  const value = useContext(ClockContext);
  if (!value) throw new Error("Clock is missing.");
  return value;
}

export function ClockBar() {
  const pathname = usePathname();
  const { workout, selectedId, startedAt, countdownUntil, now, armedUntil, tap, cycle, cancel } = useClock();
  const onWorkout = pathname === "/" || pathname.startsWith("/workout/");
  const running = startedAt != null;
  const counting = countdownUntil != null && !running;
  const option = workout?.parts.find((part) => part.id === selectedId) ?? workout?.parts[0] ?? null;
  const plan: ClockPlan = option?.plan ?? OPEN_CLOCK;
  const elapsed = running ? Math.max(0, (now - startedAt) / 1000) : 0;
  const face = clockFace(plan, elapsed);
  const armed = running && armedUntil > now;
  const second = counting ? prestartSecond(Math.max(0, (countdownUntil - now) / 1000)) : 0;
  const mark = useRef(face.mark);

  useEffect(() => {
    if (!running) {
      mark.current = face.mark;
      return;
    }
    if (face.mark > mark.current) beep();
    mark.current = face.mark;
  }, [face.mark, running]);

  useEffect(() => {
    if (!onWorkout && countdownUntil != null) cancel();
  }, [onWorkout, countdownUntil, cancel]);

  if (!onWorkout && !running) return null;

  const label = counting
    ? "Countdown. Tap to cancel"
    : armed
      ? "Tap again to stop the clock"
      : running
        ? "Clock running. Tap to arm stop"
        : "Start clock";

  return (
    <div className="clock-row">
      <button
        type="button"
        className="clock"
        data-armed={armed ? "true" : "false"}
        data-counting={counting ? "true" : "false"}
        aria-label={label}
        onClick={tap}
      >
        <span className="clock-time" aria-live={counting ? "polite" : "off"}>
          {counting ? String(Math.max(1, second)) : face.display}
        </span>
        <span className="clock-meta">
          <span className="clock-caption">{armed ? "Tap again" : counting ? "Get ready" : face.caption}</span>
          <span className="clock-hint">{counting ? "Tap to cancel" : running && option ? option.name : "Tap to start"}</span>
        </span>
      </button>
      {workout && workout.parts.length > 1 && !running && !counting ? (
        <button type="button" className="clock-switch" onClick={cycle}>
          {option?.name}
        </button>
      ) : null}
    </div>
  );
}

let audio: AudioContext | null = null;

function unlockAudio() {
  const Ctx = window.AudioContext;
  if (!Ctx) return;
  if (!audio) audio = new Ctx();
  if (audio.state === "suspended") void audio.resume();
}

function tone(freq: number, duration: number, peak: number) {
  unlockAudio();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(start + duration + 0.02);
}

function beep() {
  tone(880, 0.18, 0.08);
}

function goBeep() {
  tone(660, 0.45, 0.1);
}
