"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type WorkoutContextType = {
  isActive: boolean;
  durationSeconds: number;
  totalVolume: number;
  startWorkout: () => void;
  finishWorkout: () => void;
  cancelWorkout: () => void;
  updateVolume: (volume: number) => void;
};

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);

  // Global Workout Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive) {
      interval = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const startWorkout = () => {
    setIsActive(true);
    setDurationSeconds(0);
    setTotalVolume(0);
  };

  const finishWorkout = () => {
    setIsActive(false);
    // TODO: Salva sessione su database tramite Supabase
  };

  const cancelWorkout = () => {
    setIsActive(false);
    setDurationSeconds(0);
    setTotalVolume(0);
    // TODO: Elimina bozza sessione dal database
  };

  const updateVolume = (volume: number) => {
    setTotalVolume(volume);
  };

  return (
    <WorkoutContext.Provider
      value={{
        isActive,
        durationSeconds,
        totalVolume,
        startWorkout,
        finishWorkout,
        cancelWorkout,
        updateVolume,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const context = useContext(WorkoutContext);
  if (context === undefined) {
    throw new Error("useWorkout deve essere usato all'interno di un WorkoutProvider");
  }
  return context;
}
