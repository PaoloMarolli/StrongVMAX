"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { storage, WorkoutExercise, calculateSetVolume } from "@/utils/storage";
import { usePathname } from "next/navigation";

type WorkoutContextType = {
  isActive: boolean;
  durationSeconds: number;
  totalVolume: number;
  workoutName: string;
  activeExercises: WorkoutExercise[];
  isBottomBarVisible: boolean;
  setBottomBarVisible: (visible: boolean) => void;
  startWorkout: (name?: string, exercises?: WorkoutExercise[]) => void;
  finishWorkout: () => void;
  cancelWorkout: () => void;
  updateVolume: (volume: number) => void;
  setActiveExercises: React.Dispatch<React.SetStateAction<WorkoutExercise[]>>;
  setWorkoutName: (name: string) => void;
  isMinimized: boolean;
  setIsMinimized: (minimized: boolean) => void;
  pageAnimationClass: string;
};

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [workoutName, setWorkoutName] = useState("Workout libero");
  const [activeExercises, setActiveExercises] = useState<WorkoutExercise[]>([]);
  const [isBottomBarVisible, setBottomBarVisible] = useState(true);

  // Dynamic Page transitions tracking
  const pathname = usePathname();
  const [pageAnimationClass, setPageAnimationClass] = useState("apple-page");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const paths = ["/", "/history", "/exercises"];
      const lastPath = sessionStorage.getItem("vmax_last_path");
      
      if (lastPath && lastPath !== pathname) {
        const prevIdx = paths.indexOf(lastPath);
        const curIdx = paths.indexOf(pathname);
        
        if (prevIdx !== -1 && curIdx !== -1) {
          if (curIdx > prevIdx) {
            setPageAnimationClass("page-slide-right");
          } else {
            setPageAnimationClass("page-slide-left");
          }
        } else {
          setPageAnimationClass("apple-page");
        }
      } else {
        setPageAnimationClass("apple-page");
      }
      
      sessionStorage.setItem("vmax_last_path", pathname);
    }
  }, [pathname]);

  // Restore active session details on mount if they exist in localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedStart = localStorage.getItem("vmax_active_workout_start_time");
      const savedExercises = localStorage.getItem("vmax_active_exercises");
      const savedName = localStorage.getItem("vmax_active_workout_name");
      const savedIsActive = localStorage.getItem("vmax_active_workout_is_active");
      const savedIsMinimized = localStorage.getItem("vmax_active_workout_is_minimized");

      if (savedIsActive === "true" && savedStart) {
        setIsActive(true);
        setStartTime(parseInt(savedStart, 10));
        if (savedExercises) setActiveExercises(JSON.parse(savedExercises));
        if (savedName) setWorkoutName(savedName);
        if (savedIsMinimized === "true") setIsMinimized(true);
      }
    }
  }, []);

  // Sync state changes to localStorage to prevent data loss on full refresh
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (isActive) {
        localStorage.setItem("vmax_active_workout_is_active", "true");
        if (startTime) localStorage.setItem("vmax_active_workout_start_time", startTime.toString());
        localStorage.setItem("vmax_active_exercises", JSON.stringify(activeExercises));
        localStorage.setItem("vmax_active_workout_name", workoutName);
        localStorage.setItem("vmax_active_workout_is_minimized", isMinimized.toString());
      } else {
        localStorage.removeItem("vmax_active_workout_is_active");
        localStorage.removeItem("vmax_active_workout_start_time");
        localStorage.removeItem("vmax_active_exercises");
        localStorage.removeItem("vmax_active_workout_name");
        localStorage.removeItem("vmax_active_workout_is_minimized");
      }
    }
  }, [isActive, startTime, activeExercises, workoutName, isMinimized]);

  // Global Workout Timer using absolute millisecond deltas for background stability
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && startTime) {
      const updateTimer = () => {
        const delta = Math.floor((Date.now() - startTime) / 1000);
        setDurationSeconds(Math.max(0, delta));
      };

      updateTimer(); // Immediate calculate
      interval = setInterval(updateTimer, 1000);

      // Instantly sync time when app recovers focus or visibility changes
      const syncOnWakeup = () => {
        updateTimer();
      };
      window.addEventListener("focus", syncOnWakeup);
      window.addEventListener("visibilitychange", syncOnWakeup);

      return () => {
        clearInterval(interval);
        window.removeEventListener("focus", syncOnWakeup);
        window.removeEventListener("visibilitychange", syncOnWakeup);
      };
    } else {
      setDurationSeconds(0);
    }
  }, [isActive, startTime]);

  // Dynamically calculate total volume whenever activeExercises changes
  useEffect(() => {
    let vol = 0;
    const exercises = storage.getExercises();
    activeExercises.forEach((ex) => {
      const foundEx = exercises.find(e => e.id === ex.exerciseId);
      const isDuration = foundEx ? foundEx.equipment.toLowerCase().includes("durata") : false;
      ex.sets.forEach((set) => {
        vol += calculateSetVolume(set.weight, set.reps, set.type, isDuration);
      });
    });
    setTotalVolume(vol);
  }, [activeExercises]);

  const startWorkout = (name = "Workout libero", initialExercises: WorkoutExercise[] = []) => {
    setWorkoutName(name);
    
    // If no exercises are provided, start with a default empty exercise card
    if (initialExercises.length === 0) {
      setActiveExercises([
        {
          exerciseId: "e1", // Panca piana
          exerciseName: "Panca piana",
          sets: [{ weight: 0, reps: 0, setOrder: 1 }]
        }
      ]);
    } else {
      setActiveExercises(initialExercises);
    }
    
    const now = Date.now();
    setStartTime(now);
    setIsActive(true);
    setIsMinimized(false);
    setDurationSeconds(0);
    setTotalVolume(0);
  };

  const finishWorkout = () => {
    setIsActive(false);
    setIsMinimized(false);
    
    // Save session to LocalStorage history
    storage.saveWorkout({
      name: workoutName,
      durationSeconds,
      totalVolume,
      exercises: activeExercises.filter(ex => ex.sets.some(s => s.reps > 0 || s.weight > 0)), // save only non-empty sets
    });

    // Reset State
    setStartTime(null);
    setDurationSeconds(0);
    setTotalVolume(0);
    setActiveExercises([]);
  };

  const cancelWorkout = () => {
    setIsActive(false);
    setIsMinimized(false);
    setStartTime(null);
    setDurationSeconds(0);
    setTotalVolume(0);
    setActiveExercises([]);
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
        workoutName,
        activeExercises,
        isBottomBarVisible,
        setBottomBarVisible,
        startWorkout,
        finishWorkout,
        cancelWorkout,
        updateVolume,
        setActiveExercises,
        setWorkoutName,
        isMinimized,
        setIsMinimized,
        pageAnimationClass,
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
