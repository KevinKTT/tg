"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { saveScore } from "@/lib/actions";
import { clockFace, OPEN_CLOCK, splitElapsed, type ClockPlan, type ClockWorkout } from "@/lib/clock";

type ClockContextValue = {
  workout: ClockWorkout | null;
  selectedId: number | null;
  startedAt: number | null;
  now: number;
  armedUntil: number;
  register: (next: ClockWorkout | null) => void;
  tap: () => void;
  cycle: () => void;
};

const ClockContext = createContext<ClockContextValue | null>(null);

export function ClockProvider({ children }: { children: React.ReactNode }) {
  const [workout, setWorkout] = useState<ClockWorkout | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [armedUntil, setArmedUntil] = useState(0);
  const runningRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const armedUntilRef = useRef(0);
  const workoutRef = useRef<ClockWorkout | null>(null);
  const selectedIdRef = useRef<number | null>(null);

  useEffect(() => {
    startedAtRef.current = startedAt;
    armedUntilRef.current = armedUntil;
    workoutRef.current = workout;
    selectedIdRef.current = selectedId;
  }, [startedAt, armedUntil, workout, selectedId]);

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

  const stop = useCallback(async () => {
    const started = startedAtRef.current;
    const current = workoutRef.current;
    const selected = selectedIdRef.current;
    const option = current?.parts.find((part) => part.id === selected) ?? current?.parts[0];
    runningRef.current = false;
    startedAtRef.current = null;
    armedUntilRef.current = 0;
    setStartedAt(null);
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
    if (!runningRef.current) {
      start();
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
  }, [start, stop]);

  const cycle = useCallback(() => {
    if (runningRef.current) return;
    setSelectedId((current) => {
      const parts = workoutRef.current?.parts ?? [];
      if (parts.length < 2) return current;
      const index = parts.findIndex((part) => part.id === current);
      return parts[(index + 1) % parts.length]?.id ?? current;
    });
  }, []);

  useEffect(() => {
    if (startedAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    if (startedAt == null || !("wakeLock" in navigator)) return;
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
  }, [startedAt]);

  const value = useMemo(
    () => ({ workout, selectedId, startedAt, now, armedUntil, register, tap, cycle }),
    [workout, selectedId, startedAt, now, armedUntil, register, tap, cycle],
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
  const { workout, selectedId, startedAt, now, armedUntil, tap, cycle } = useClock();
  const onWorkout = pathname === "/" || pathname.startsWith("/workout/");
  const running = startedAt != null;
  const option = workout?.parts.find((part) => part.id === selectedId) ?? workout?.parts[0] ?? null;
  const plan: ClockPlan = option?.plan ?? OPEN_CLOCK;
  const elapsed = running ? Math.max(0, (now - startedAt) / 1000) : 0;
  const face = clockFace(plan, elapsed);
  const armed = running && armedUntil > now;
  const mark = useRef(face.mark);

  useEffect(() => {
    if (!running) {
      mark.current = face.mark;
      return;
    }
    if (face.mark > mark.current) beep();
    mark.current = face.mark;
  }, [face.mark, running]);

  if (!onWorkout && !running) return null;

  return (
    <div className="clock-row">
      <button
        type="button"
        className="clock"
        data-armed={armed ? "true" : "false"}
        aria-label={armed ? "Tap again to stop the clock" : running ? "Clock running. Tap to arm stop" : "Start clock"}
        onClick={tap}
      >
        <span className="clock-time">{face.display}</span>
        <span className="clock-meta">
          <span className="clock-caption">{armed ? "Tap again" : face.caption}</span>
          <span className="clock-hint">{running && option ? option.name : "Tap to start"}</span>
        </span>
      </button>
      {workout && workout.parts.length > 1 && !running ? (
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

function beep() {
  unlockAudio();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.2);
}
