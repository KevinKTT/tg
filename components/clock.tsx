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
  roundTotal,
  sessionElapsedSec,
  showsRoundCounter,
  splitElapsed,
  type ClockPlan,
  type ClockWorkout,
} from "@/lib/clock";
import { formatTime } from "@/lib/scoring";

type SessionState = {
  date: string;
  accumulatedSec: number;
  runningSince: number | null;
  started: boolean;
};

type ClockContextValue = {
  workout: ClockWorkout | null;
  selectedId: number | null;
  workoutAccumulatedSec: number;
  workoutRunningSince: number | null;
  workoutStarted: boolean;
  countdownUntil: number | null;
  now: number;
  armedUntil: number;
  session: SessionState | null;
  register: (next: ClockWorkout | null) => void;
  tapWorkout: (id?: number) => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  stopWorkout: () => void;
  toggleSession: () => void;
  resetSession: () => void;
};

const ClockContext = createContext<ClockContextValue | null>(null);

function sessionKey(date: string) {
  return `tg-session:${date}`;
}

function loadSession(date: string): SessionState {
  try {
    const raw = localStorage.getItem(sessionKey(date));
    const parsed = raw ? (JSON.parse(raw) as Partial<SessionState>) : null;
    if (parsed && typeof parsed.accumulatedSec === "number") {
      return {
        date,
        accumulatedSec: Math.max(0, parsed.accumulatedSec),
        runningSince: typeof parsed.runningSince === "number" ? parsed.runningSince : null,
        started: Boolean(parsed.started || parsed.runningSince),
      };
    }
  } catch {
    // Storage can be blocked. The clock still works for this view.
  }
  return { date, accumulatedSec: 0, runningSince: null, started: false };
}

export function ClockProvider({ children }: { children: React.ReactNode }) {
  const [workout, setWorkout] = useState<ClockWorkout | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [workoutAccumulatedSec, setWorkoutAccumulatedSec] = useState(0);
  const [workoutRunningSince, setWorkoutRunningSince] = useState<number | null>(null);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [countdownUntil, setCountdownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [armedUntil, setArmedUntil] = useState(0);
  const [session, setSession] = useState<SessionState | null>(null);
  const workoutActiveRef = useRef(false);
  const workoutRunningSinceRef = useRef<number | null>(null);
  const workoutAccumulatedRef = useRef(0);
  const workoutStartedRef = useRef(false);
  const countdownUntilRef = useRef<number | null>(null);
  const announcedRef = useRef(PRESTART_SEC);
  const armedUntilRef = useRef(0);
  const workoutRef = useRef<ClockWorkout | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  const sessionRef = useRef<SessionState | null>(null);

  useEffect(() => {
    workoutRunningSinceRef.current = workoutRunningSince;
    workoutAccumulatedRef.current = workoutAccumulatedSec;
    workoutStartedRef.current = workoutStarted;
    countdownUntilRef.current = countdownUntil;
    armedUntilRef.current = armedUntil;
    workoutRef.current = workout;
    selectedIdRef.current = selectedId;
    sessionRef.current = session;
    workoutActiveRef.current = workoutStarted || countdownUntil != null;
  }, [workoutRunningSince, workoutAccumulatedSec, workoutStarted, countdownUntil, armedUntil, workout, selectedId, session]);

  useEffect(() => {
    if (!session) return;
    try {
      localStorage.setItem(sessionKey(session.date), JSON.stringify(session));
    } catch {
      // Storage can be blocked.
    }
  }, [session]);

  const register = useCallback((next: ClockWorkout | null) => {
    if (next) {
      setSession((current) => (current?.date === next.date ? current : loadSession(next.date)));
    }
    if (workoutActiveRef.current) return;
    setWorkout(next);
    setSelectedId((current) => {
      if (next && current != null && next.parts.some((part) => part.id === current)) return current;
      return next?.defaultId ?? null;
    });
  }, []);

  const startWorkout = useCallback(() => {
    unlockAudio();
    workoutActiveRef.current = true;
    workoutStartedRef.current = true;
    workoutAccumulatedRef.current = 0;
    const stamp = Date.now();
    workoutRunningSinceRef.current = stamp;
    armedUntilRef.current = 0;
    setWorkoutAccumulatedSec(0);
    setWorkoutRunningSince(stamp);
    setWorkoutStarted(true);
    setNow(stamp);
    setArmedUntil(0);
  }, []);

  const cancelCountdown = useCallback(() => {
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
    workoutActiveRef.current = true;
    setCountdownUntil(until);
    setNow(stamp);
  }, []);

  const stopWorkout = useCallback(async () => {
    const current = workoutRef.current;
    const selected = selectedIdRef.current;
    const option = current?.parts.find((part) => part.id === selected) ?? current?.parts[0];
    const elapsed = sessionElapsedSec(workoutAccumulatedRef.current, workoutRunningSinceRef.current, Date.now());
    workoutActiveRef.current = false;
    workoutRunningSinceRef.current = null;
    workoutAccumulatedRef.current = 0;
    workoutStartedRef.current = false;
    countdownUntilRef.current = null;
    announcedRef.current = PRESTART_SEC;
    armedUntilRef.current = 0;
    setWorkoutRunningSince(null);
    setWorkoutAccumulatedSec(0);
    setWorkoutStarted(false);
    setCountdownUntil(null);
    setArmedUntil(0);
    if (!current || !option?.plan.savesTime || elapsed <= 0) return;
    const split = splitElapsed(elapsed);
    if (!split) return;
    const form = new FormData();
    form.set("partId", String(option.id));
    form.set("athlete", current.athlete);
    form.set("scoreType", "time");
    form.set("minutes", String(split.minutes));
    form.set("seconds", String(split.seconds));
    form.set("unit", "lb");
    try {
      await saveScore(form);
    } catch {
      // The clock is stopped. The score form is still on the page.
    }
  }, []);

  const pauseWorkout = useCallback(() => {
    const since = workoutRunningSinceRef.current;
    if (since == null) return;
    const stamp = Date.now();
    const accumulated = sessionElapsedSec(workoutAccumulatedRef.current, since, stamp);
    workoutAccumulatedRef.current = accumulated;
    workoutRunningSinceRef.current = null;
    armedUntilRef.current = 0;
    setWorkoutAccumulatedSec(accumulated);
    setWorkoutRunningSince(null);
    setArmedUntil(0);
    setNow(stamp);
  }, []);

  const resumeWorkout = useCallback(() => {
    if (!workoutStartedRef.current || workoutRunningSinceRef.current != null) return;
    unlockAudio();
    const stamp = Date.now();
    workoutRunningSinceRef.current = stamp;
    setWorkoutRunningSince(stamp);
    setNow(stamp);
  }, []);

  const tapWorkout = useCallback(
    (id?: number) => {
      if (id != null) {
        selectedIdRef.current = id;
        setSelectedId(id);
      }
      if (countdownUntilRef.current != null) {
        cancelCountdown();
        workoutActiveRef.current = workoutStartedRef.current;
        return;
      }
      if (!workoutStartedRef.current) {
        beginCountdown();
        return;
      }
      if (workoutRunningSinceRef.current == null) {
        resumeWorkout();
        return;
      }
      if (armedUntilRef.current > Date.now()) {
        void stopWorkout();
        return;
      }
      const until = Date.now() + 2000;
      armedUntilRef.current = until;
      setArmedUntil(until);
      setNow(Date.now());
    },
    [beginCountdown, cancelCountdown, resumeWorkout, stopWorkout],
  );

  const toggleSession = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    unlockAudio();
    const stamp = Date.now();
    if (current.runningSince != null) {
      const next = {
        ...current,
        accumulatedSec: sessionElapsedSec(current.accumulatedSec, current.runningSince, stamp),
        runningSince: null,
        started: true,
      };
      sessionRef.current = next;
      setSession(next);
    } else {
      const next = { ...current, runningSince: stamp, started: true };
      sessionRef.current = next;
      setSession(next);
    }
    setNow(stamp);
  }, []);

  const resetSession = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    const next = { date: current.date, accumulatedSec: 0, runningSince: null, started: false };
    sessionRef.current = next;
    setSession(next);
    setNow(Date.now());
  }, []);

  const sessionRunningSince = session?.runningSince ?? null;
  const ticking = countdownUntil != null || workoutRunningSince != null || sessionRunningSince != null;

  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => {
      const stamp = Date.now();
      const until = countdownUntilRef.current;
      if (until != null && workoutRunningSinceRef.current == null && !workoutStartedRef.current) {
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
          startWorkout();
        }
      }
      setNow(stamp);
    }, 200);
    return () => window.clearInterval(id);
  }, [ticking, startWorkout]);

  useEffect(() => {
    if (!ticking || !("wakeLock" in navigator)) return;
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
  }, [ticking]);

  const value = useMemo(
    () => ({
      workout,
      selectedId,
      workoutAccumulatedSec,
      workoutRunningSince,
      workoutStarted,
      countdownUntil,
      now,
      armedUntil,
      session,
      register,
      tapWorkout,
      pauseWorkout,
      resumeWorkout,
      stopWorkout,
      toggleSession,
      resetSession,
    }),
    [
      workout,
      selectedId,
      workoutAccumulatedSec,
      workoutRunningSince,
      workoutStarted,
      countdownUntil,
      now,
      armedUntil,
      session,
      register,
      tapWorkout,
      pauseWorkout,
      resumeWorkout,
      stopWorkout,
      toggleSession,
      resetSession,
    ],
  );

  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>;
}

export function useClock() {
  const value = useContext(ClockContext);
  if (!value) throw new Error("Clock is missing.");
  return value;
}

export function SessionClock() {
  const pathname = usePathname();
  const { session, now, toggleSession, resetSession } = useClock();
  const onWorkout = pathname === "/" || pathname.startsWith("/workout/");
  const running = session?.runningSince != null;
  const elapsed = session ? sessionElapsedSec(session.accumulatedSec, session.runningSince, now) : 0;

  if (!session || (!onWorkout && !session.started)) return null;

  const label = running ? "Session clock running. Tap to pause" : session.started ? "Session clock paused. Tap to resume" : "Start session clock";

  return (
    <div className="clock-row session-clock-row">
      <button type="button" className="clock session-clock" data-paused={session.started && !running ? "true" : "false"} aria-label={label} onClick={toggleSession}>
        <span className="clock-time session-time">{formatTime(elapsed)}</span>
        <span className="clock-meta">
          <span className="clock-caption">{running ? "Session" : session.started ? "Paused" : "Session"}</span>
          <span className="clock-hint">{running ? "Tap to pause" : session.started ? "Tap to resume" : "Tap to start"}</span>
        </span>
      </button>
      {session.started ? (
        <button
          type="button"
          className="clock-switch"
          aria-label="Reset session clock"
          onClick={() => {
            if (!running || window.confirm("Reset the session clock?")) resetSession();
          }}
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}

function roundsKey(date: string, partId: number) {
  return `tg-rounds:${date}:${partId}`;
}

export function WorkoutClock({ partId }: { partId: number }) {
  const pathname = usePathname();
  const { workout, workoutAccumulatedSec, workoutRunningSince, workoutStarted, countdownUntil, now, armedUntil, tapWorkout, pauseWorkout, stopWorkout, cancelWorkout } =
    useWorkoutClockControls();
  const onWorkout = pathname === "/" || pathname.startsWith("/workout/");
  const running = workoutRunningSince != null;
  const counting = countdownUntil != null && !workoutStarted;
  const paused = workoutStarted && !running && !counting;
  const option = workout?.parts.find((part) => part.id === partId) ?? null;
  const plan: ClockPlan = option?.plan ?? OPEN_CLOCK;
  const elapsed = sessionElapsedSec(workoutAccumulatedSec, workoutRunningSince, now);
  const face = clockFace(plan, elapsed);
  const armed = running && armedUntil > now;
  const second = counting && countdownUntil ? prestartSecond(Math.max(0, (countdownUntil - now) / 1000)) : 0;
  const mark = useRef(face.mark);
  const [rounds, setRounds] = useState(0);

  useEffect(() => {
    if (!workout) return;
    try {
      const raw = localStorage.getItem(roundsKey(workout.date, partId));
      const parsed = raw ? Number(JSON.parse(raw)) : 0;
      /* eslint-disable react-hooks/set-state-in-effect */
      setRounds(Number.isInteger(parsed) && parsed > 0 ? parsed : 0);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      setRounds(0);
    }
  }, [workout, partId]);

  useEffect(() => {
    if (!running && !paused) {
      mark.current = face.mark;
      return;
    }
    if (face.mark > mark.current) beep();
    mark.current = face.mark;
  }, [face.mark, running, paused]);

  useEffect(() => {
    if (!onWorkout && countdownUntil != null) cancelWorkout();
  }, [onWorkout, countdownUntil, cancelWorkout]);

  if (!onWorkout || !workout || !option) return null;

  const total = roundTotal(option.format, option.scheme);
  const showRounds = showsRoundCounter(option);

  function changeRounds(next: number) {
    const value = Math.max(0, next);
    setRounds(value);
    try {
      localStorage.setItem(roundsKey(workout!.date, partId), JSON.stringify(value));
    } catch {
      // Storage can be blocked.
    }
  }

  const label = counting
    ? "Countdown. Tap to cancel"
    : armed
      ? "Tap again to stop the clock"
      : paused
        ? "Workout clock paused. Tap to resume"
        : running
          ? "Workout clock running. Tap to arm stop"
          : "Start workout clock";

  return (
    <div className="workout-clock-wrap">
      <div className="clock-row">
        <button
          type="button"
          className="clock workout-clock"
          data-armed={armed ? "true" : "false"}
          data-counting={counting ? "true" : "false"}
          data-paused={paused ? "true" : "false"}
          aria-label={label}
          onClick={() => tapWorkout(partId)}
        >
          <span className="clock-time" aria-live={counting ? "polite" : "off"}>
            {counting ? String(Math.max(1, second)) : face.display}
          </span>
          <span className="clock-meta">
            <span className="clock-caption">{armed ? "Tap again" : counting ? "Get ready" : paused ? "Paused" : face.caption}</span>
            <span className="clock-hint">{counting ? "Tap to cancel" : paused ? "Tap to resume" : running ? option.name : "Tap to start workout"}</span>
          </span>
        </button>
        {running ? (
          <button type="button" className="clock-switch" onClick={pauseWorkout}>
            Pause
          </button>
        ) : paused ? (
          <button
            type="button"
            className="clock-switch"
            onClick={() => {
              if (window.confirm("Stop the workout clock? A for-time score will be saved.")) stopWorkout();
            }}
          >
            Stop
          </button>
        ) : null}
      </div>
      {showRounds ? (
        <div className="round-counter">
          <span className="round-label">
            Rounds done <strong>{rounds}</strong>
            {total ? <span className="faint"> / {total}</span> : null}
          </span>
          <span className="round-actions">
            <button type="button" className="btn" aria-label="Undo one round" disabled={rounds === 0} onClick={() => changeRounds(rounds - 1)}>
              − Round
            </button>
            <button type="button" className="btn btn-primary" onClick={() => changeRounds(rounds + 1)}>
              + Round
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function useWorkoutClockControls() {
  const value = useClock();
  return { ...value, cancelWorkout: value.tapWorkout };
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
