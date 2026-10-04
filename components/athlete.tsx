"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Unit } from "@/lib/athletes";
import type { AthleteRow } from "@/lib/db";

type AthleteState = {
  members: AthleteRow[];
  athlete: string | null;
  current: AthleteRow | null;
  setAthlete: (athlete: string) => void;
  unit: Unit;
  setUnit: (unit: Unit) => void;
  ready: boolean;
  hasChosen: boolean;
};

const AthleteContext = createContext<AthleteState | null>(null);

export function AthleteProvider({ children, members }: { children: React.ReactNode; members: AthleteRow[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [unit, setUnitState] = useState<Unit>("lb");
  const [ready, setReady] = useState(false);
  const [hasChosen, setHasChosen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tg-athlete");
      const savedUnit = localStorage.getItem("tg-unit");
      /* eslint-disable react-hooks/set-state-in-effect */
      if (saved && members.some((member) => member.slug === saved)) {
        setSelected(saved);
        setHasChosen(true);
      }
      if (savedUnit === "kg" || savedUnit === "lb") setUnitState(savedUnit);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      // Storage can be blocked; fall through and let the gate ask.
    }
    setReady(true);
    // Run once on mount; members are read from storage validation only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected && !members.some((member) => member.slug === selected)) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setSelected(null);
      setHasChosen(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      try {
        localStorage.removeItem("tg-athlete");
      } catch {
        // Ignore storage failures.
      }
    }
  }, [members, selected]);

  const athlete = selected ?? members[0]?.slug ?? null;
  const current = useMemo(() => members.find((member) => member.slug === athlete) ?? null, [members, athlete]);

  function setAthlete(next: string) {
    if (!members.some((member) => member.slug === next)) return;
    setSelected(next);
    setHasChosen(true);
    try {
      localStorage.setItem("tg-athlete", next);
    } catch {
      // Ignore storage failures; the choice still applies for this session.
    }
  }

  function setUnit(next: Unit) {
    setUnitState(next);
    try {
      localStorage.setItem("tg-unit", next);
    } catch {
      // Ignore storage failures.
    }
  }

  return (
    <AthleteContext.Provider
      value={{ members, athlete, current, setAthlete, unit, setUnit, ready, hasChosen }}
    >
      {children}
    </AthleteContext.Provider>
  );
}

export function useAthlete() {
  const value = useContext(AthleteContext);
  if (!value) throw new Error("Athlete switch is missing.");
  return value;
}

export function AthleteSwitch({ className = "" }: { className?: string }) {
  const { athlete, setAthlete, members } = useAthlete();
  if (members.length === 0) return null;
  return (
    <div className={`athlete-switch ${className}`}>
      {members.map((member) => (
        <button key={member.slug} type="button" data-on={athlete === member.slug} onClick={() => setAthlete(member.slug)}>
          {member.initials}
        </button>
      ))}
    </div>
  );
}
