"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWorkout } from "@/context/WorkoutContext";
import { Check, Play, Pause, FastForward, Plus, Trash2, X, Pencil, History, ChevronUp, ChevronDown, Timer, ArrowUpDown, MoreHorizontal, Download } from "lucide-react";
import { storage, Exercise, calculateSetVolume } from "@/utils/storage";
import { useSession, signIn } from "next-auth/react";

function formatRestDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "90s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m} min`;
  return `${s}s`;
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function secondsToHHMMSS(seconds: number): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function hhmmssToSeconds(str: string): number {
  if (!str) return 0;
  const parts = str.split(":").map(p => parseInt(p, 10) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

function SpotifyLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.22.36-.68.476-1.04.256-2.855-1.745-6.45-2.14-10.684-1.172-.406.094-.813-.162-.907-.568-.094-.406.162-.813.568-.907 4.636-1.06 8.605-.61 11.796 1.34.36.22.476.68.256 1.04zm1.47-3.267c-.276.446-.86.586-1.306.31-3.267-2.007-8.248-2.59-12.115-1.416-.5.152-1.026-.13-1.178-.63-.15-.5.13-1.026.63-1.178 4.417-1.34 9.907-.69 13.659 1.61.446.276.586.86.31 1.306zm.127-3.41c-3.918-2.327-10.38-2.542-14.137-1.402-.6.182-1.232-.163-1.414-.764-.182-.6.163-1.232.764-1.414 4.312-1.308 11.446-1.05 15.965 1.63.54.32.72 1.02.4 1.56-.32.54-1.02.72-1.56.402z" />
    </svg>
  );
}

function GoogleSheetsLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" fill="#0F9D58" />
      <path d="M14 3v6h7L14 3z" fill="#87CEAC" />
      <path d="M7 11h10v2H7v-2zm0 4h10v2H7v-2zm0-8h5v2H7V7z" fill="#FFFFFF" />
    </svg>
  );
}

function triggerIOSNativeTimer(seconds: number) {
  if (typeof window === "undefined" || seconds <= 0) return;
  const shortcutName = encodeURIComponent("StrongVMAX Timer");
  window.location.href = `shortcuts://run-shortcut?name=${shortcutName}&input=text&text=${seconds}`;
}

export default function ActiveWorkout() {
  const { 
    isActive, 
    durationSeconds, 
    workoutName,
    setWorkoutName,
    activeExercises, 
    setActiveExercises,
    finishWorkout, 
    cancelWorkout,
    isMinimized,
    setIsMinimized
  } = useWorkout();

  const { data: session } = useSession();

  // Google Sheets Syncing States
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"syncing" | "success" | "error" | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState("");

  // Edit Workout Name Modal State
  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
  const [editedWorkoutName, setEditedWorkoutName] = useState("");
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);

  // Exercise History Modal State
  const [selectedHistoryExercise, setSelectedHistoryExercise] = useState<{ id: string; name: string } | null>(null);

  // Rest Timer State
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [isRestPaused, setIsRestPaused] = useState(false);
  const [restEndTime, setRestEndTime] = useState<number | null>(null);
  const [completedSets, setCompletedSets] = useState<Record<string, boolean>>({});
  const [defaultRestSeconds, setDefaultRestSeconds] = useState(90);
  const [activeRestTotalDuration, setActiveRestTotalDuration] = useState<number>(90);

  // Exercise Reorder Modal State
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);

  // Custom Exercise Rest Timer Modal State
  const [selectedTimerExerciseIdx, setSelectedTimerExerciseIdx] = useState<number | null>(null);
  const [tempTimerSeconds, setTempTimerSeconds] = useState<number>(90);
  const [isCustomTimerModalOpen, setIsCustomTimerModalOpen] = useState(false);

  // RPE Picker State
  const [rpePickerState, setRpePickerState] = useState<{ exIdx: number; setIdx: number } | null>(null);
  
  // Resting Set Tracking State
  const [restingSetKey, setRestingSetKey] = useState<string | null>(null);

  // Add Exercise Modal State
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);
  const [catalog, setCatalog] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Exercises catalog loaded from local-first storage
  const [exercisesCatalog, setExercisesCatalog] = useState<Exercise[]>([]);

  // Local state for duration strings to prevent cursor jumps
  const [timeInputs, setTimeInputs] = useState<Record<string, string>>({});

  // Local state for weight strings to support decimal commas without stripping
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({});

  // Custom Keypad State
  const [activeKeypad, setActiveKeypad] = useState<{
    exIdx: number;
    setIdx: number;
    field: "weight" | "reps";
  } | null>(null);

  // Custom Highlight/Overwrite State
  const [shouldOverwrite, setShouldOverwrite] = useState(false);
  const [keypadHighlightTrigger, setKeypadHighlightTrigger] = useState(0);

  // Swipe to Delete State
  const [swipingSetKey, setSwipingSetKey] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const swipeStartX = useRef<number>(0);

  // Drag modal down to minimize gesture state
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef(0);
  const dragStartX = useRef(0);
  const isDragging = useRef(false);

  // Create Custom Exercise Inline inside Active Workout Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMuscleGroup, setNewMuscleGroup] = useState("Petto");
  const [newEquipment, setNewEquipment] = useState("Bilanciere");
  const [newBarbellPreset, setNewBarbellPreset] = useState("Olimpico (20 kg)");
  const [newCustomBarbellText, setNewCustomBarbellText] = useState("");

  const [hasEntered, setHasEntered] = useState(false);

  // Trigger enter slide-up transition shortly after active workout mounts/starts
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => setHasEntered(true), 50);
      return () => clearTimeout(timer);
    } else {
      setHasEntered(false);
    }
  }, [isActive]);

  // Lock body scroll when active workout modal is expanded to prevent background scrolling
  useEffect(() => {
    if (isActive && !isMinimized) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100vh";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, [isActive, isMinimized]);

  useEffect(() => {
    if (isActive) {
      setExercisesCatalog(storage.getExercises());
      setWeightInputs({});
      setTimeInputs({});
      setActiveKeypad(null);
      setDragOffset(0);
      
      // Load custom rest timer preference from localStorage
      if (typeof window !== "undefined") {
        const storedRest = localStorage.getItem("default_rest_seconds");
        if (storedRest) {
          setDefaultRestSeconds(parseInt(storedRest, 10) || 90);
        }
      }
    }
  }, [isActive]);

  // Ensure all active exercises have their custom or stored restSeconds
  useEffect(() => {
    setActiveExercises((prev) => {
      const needsRest = prev.some((ex) => !ex.restSeconds);
      if (!needsRest) return prev;
      return prev.map((ex) => ({
        ...ex,
        restSeconds: ex.restSeconds || storage.getExerciseRestSeconds(ex.exerciseId, defaultRestSeconds),
      }));
    });
  }, [defaultRestSeconds, setActiveExercises]);

  // Load catalog on mount/open
  useEffect(() => {
    if (isAddExerciseOpen) {
      setCatalog(storage.getExercises());
    }
  }, [isAddExerciseOpen]);

  // Highlight active input programmatically when shouldOverwrite is enabled
  useEffect(() => {
    if (shouldOverwrite && activeKeypad && typeof window !== "undefined") {
      const { exIdx, setIdx, field } = activeKeypad;
      const inputId = `input_${exIdx}_${setIdx}_${field}`;
      const activeEl = document.getElementById(inputId) as HTMLInputElement;
      if (activeEl) {
        try {
          activeEl.focus();
          activeEl.select();
        } catch {
          // ignore selector errors
        }
      }
    }
  }, [shouldOverwrite, activeKeypad, keypadHighlightTrigger]);

  // Screen Wake Lock API to prevent phone screen from automatically turning off during workout
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (!isActive) {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      return;
    }

    const requestWakeLock = async () => {
      try {
        if (typeof navigator !== "undefined" && "wakeLock" in navigator && !wakeLockRef.current) {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
          wakeLockRef.current.addEventListener("release", () => {
            wakeLockRef.current = null;
          });
          console.log("Screen Wake Lock active: display will stay on during workout");
        }
      } catch (err) {
        console.warn("Screen Wake Lock could not be acquired:", err);
      }
    };

    requestWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isActive) {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [isActive]);

  // Countdown timer logic using absolute timestamps for background resilience
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (restEndTime && !isRestPaused) {
      const updateRestTimer = () => {
        const now = Date.now();
        const diff = Math.max(0, Math.ceil((restEndTime - now) / 1000));
        
        // Only update if greater than zero, otherwise handle completion
        if (diff <= 0) {
          setRestTimeLeft(0);
          setRestingSetKey(null);
          setRestEndTime(null);
        } else {
          setRestTimeLeft(diff);
        }
      };

      updateRestTimer(); // Initial sync
      interval = setInterval(updateRestTimer, 1000);

      // Instantly sync rest timer when recovering background focus
      const syncOnWakeup = () => {
        updateRestTimer();
      };
      window.addEventListener("focus", syncOnWakeup);
      window.addEventListener("visibilitychange", syncOnWakeup);

      return () => {
        clearInterval(interval);
        window.removeEventListener("focus", syncOnWakeup);
        window.removeEventListener("visibilitychange", syncOnWakeup);
      };
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRestPaused, restEndTime]);

  // Drag down to minimize sheet handlers
  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    dragStartY.current = e.touches[0].clientY;
    dragStartX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const handleHeaderTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const diffY = currentY - dragStartY.current;
    const diffX = currentX - dragStartX.current;
    
    if (diffY > 0 && Math.abs(diffX) < Math.abs(diffY)) {
      setDragOffset(diffY);
    }
  };

  const handleHeaderTouchEnd = () => {
    isDragging.current = false;
    if (dragOffset > 110) {
      setIsMinimized(true);
    }
    setDragOffset(0);
  };

  if (!isActive) return null;

  // Manage set values
  const updateSet = (exerciseIndex: number, setIndex: number, field: "weight" | "reps", val: string) => {
    const key = `${exerciseIndex}_${setIndex}`;
    if (field === "weight") {
      setWeightInputs((prev) => ({
        ...prev,
        [key]: val,
      }));
      const cleanVal = val.replace(",", ".");
      const num = parseFloat(cleanVal) || 0;
      setActiveExercises((prev) => {
        const copy = JSON.parse(JSON.stringify(prev));
        copy[exerciseIndex].sets[setIndex].weight = num;
        return copy;
      });
    } else {
      const cleanVal = val.replace(",", ".");
      const num = parseFloat(cleanVal) || 0;
      setActiveExercises((prev) => {
        const copy = JSON.parse(JSON.stringify(prev));
        copy[exerciseIndex].sets[setIndex].reps = num;
        return copy;
      });
    }
  };

  const handleWeightInputBlur = (exIdx: number, setIdx: number, val: string) => {
    const key = `${exIdx}_${setIdx}`;
    const cleanVal = val.replace(",", ".");
    const num = parseFloat(cleanVal) || 0;
    const formatted = num === 0 ? "" : num.toString().replace(".", ",");
    setWeightInputs((prev) => ({
      ...prev,
      [key]: formatted,
    }));
    setActiveExercises((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[exIdx].sets[setIdx].weight = num;
      return copy;
    });
  };

  const selectRpe = (val: number | undefined) => {
    if (!rpePickerState) return;
    const { exIdx, setIdx } = rpePickerState;
    setActiveExercises((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[exIdx].sets[setIdx].rpe = val;
      return copy;
    });
    setRpePickerState(null);
  };

  // Add Set
  const addSet = (exerciseIndex: number) => {
    setActiveExercises((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const sets = copy[exerciseIndex].sets;
      const lastSet = sets[sets.length - 1];
      sets.push({
        weight: lastSet ? lastSet.weight : 0,
        reps: lastSet ? lastSet.reps : 0,
        setOrder: sets.length + 1,
      });
      return copy;
    });
  };

  // Remove Set
  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setActiveExercises((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[exerciseIndex].sets.splice(setIndex, 1);
      // Re-order setOrder
      copy[exerciseIndex].sets.forEach((set: { setOrder: number }, idx: number) => {
        set.setOrder = idx + 1;
      });
      return copy;
    });

    const shiftDictionary = <T,>(setter: React.Dispatch<React.SetStateAction<Record<string, T>>>) => {
      setter(prev => {
        const next = { ...prev };
        delete next[`${exerciseIndex}_${setIndex}`];
        for (let i = setIndex + 1; i <= 50; i++) {
          const oldKey = `${exerciseIndex}_${i}`;
          const newKey = `${exerciseIndex}_${i - 1}`;
          if (next[oldKey] !== undefined) {
            next[newKey] = next[oldKey];
            delete next[oldKey];
          }
        }
        return next;
      });
    };

    shiftDictionary(setWeightInputs);
    shiftDictionary(setTimeInputs);
    shiftDictionary(setCompletedSets);
  };

  const getWeightStep = (equipment: string): number => {
    const eq = equipment.toLowerCase();
    if (eq.includes("manubri")) return 1.0;
    if (eq.includes("bilanciere") || eq.includes("smith")) return 2.5;
    if (eq.includes("carico libero") || eq.includes("dischi")) return 1.25;
    if (eq.includes("cavi")) return 2.5;
    if (eq.includes("corpo libero")) return 1.0;
    return 2.5;
  };

  const getInheritedValues = (exIdx: number, setIdx: number) => {
    let inheritedWeight = 0;
    let inheritedReps = 0;
    for (let i = setIdx - 1; i >= 0; i--) {
      const prev = activeExercises[exIdx].sets[i];
      if (prev.weight > 0 || prev.reps > 0) {
        inheritedWeight = prev.weight;
        inheritedReps = prev.reps;
        break;
      }
    }
    return { inheritedWeight, inheritedReps };
  };

  const adjustWeight = (exIdx: number, setIdx: number, step: number) => {
    const key = `${exIdx}_${setIdx}`;
    const currentSet = activeExercises[exIdx].sets[setIdx];
    let currentWeight = currentSet.weight;

    if (currentWeight === 0) {
      const { inheritedWeight } = getInheritedValues(exIdx, setIdx);
      currentWeight = inheritedWeight;
    }

    const newWeight = Math.max(0, currentWeight + step);
    const formatted = newWeight === 0 ? "" : newWeight.toString().replace(".", ",");
    setWeightInputs((prev) => ({
      ...prev,
      [key]: formatted,
    }));

    setActiveExercises((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[exIdx].sets[setIdx].weight = newWeight;
      return copy;
    });
  };

  const adjustReps = (exIdx: number, setIdx: number, step: number) => {
    const key = `${exIdx}_${setIdx}`;
    const currentSet = activeExercises[exIdx].sets[setIdx];
    let currentReps = currentSet.reps;

    if (currentReps === 0) {
      const { inheritedReps } = getInheritedValues(exIdx, setIdx);
      if (inheritedReps > 0) {
        currentReps = inheritedReps;
      } else if (activeExercises[exIdx]?.targetReps) {
        const parsed = parseInt(activeExercises[exIdx].targetReps || "", 10);
        if (!isNaN(parsed) && parsed > 0) {
          currentReps = parsed;
        }
      }
    }

    const newReps = Math.max(0, currentReps + step);

    setActiveExercises((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[exIdx].sets[setIdx].reps = newReps;
      return copy;
    });

    const foundEx = exercisesCatalog.find(c => c.id === activeExercises[exIdx].exerciseId);
    const isDuration = foundEx ? foundEx.equipment.toLowerCase().includes("durata") : false;
    if (isDuration) {
      const formatted = secondsToHHMMSS(newReps);
      setTimeInputs((prev) => ({
        ...prev,
        [key]: formatted,
      }));
    }
  };

  const handleKeypadPress = (char: string) => {
    if (!activeKeypad) return;
    const { exIdx, setIdx, field } = activeKeypad;
    const key = `${exIdx}_${setIdx}`;

    if (field === "weight") {
      let currentVal = weightInputs[key] || "";
      if (shouldOverwrite) {
        currentVal = "";
        setShouldOverwrite(false);
      }
      if (char === "," && currentVal.includes(",")) return;
      const newVal = currentVal + char;
      updateSet(exIdx, setIdx, "weight", newVal);
    } else {
      const foundEx = exercisesCatalog.find(c => c.id === activeExercises[exIdx].exerciseId);
      const isDuration = foundEx ? foundEx.equipment.toLowerCase().includes("durata") : false;

      if (isDuration) {
        let currentVal = timeInputs[key] || "";
        if (shouldOverwrite) {
          currentVal = "";
          setShouldOverwrite(false);
        }
        if (char === "," || char === ".") return;
        const clean = currentVal.replace(":", "");
        if (clean.length >= 4) return;
        const newVal = clean + char;
        
        let formatted = newVal;
        if (newVal.length > 2) {
          formatted = newVal.slice(0, newVal.length - 2) + ":" + newVal.slice(newVal.length - 2);
        }
        handleTimeInputChange(exIdx, setIdx, formatted);
      } else {
        if (char === "," || char === ".") return;
        let currentVal = "";
        if (!shouldOverwrite) {
          const currentSet = activeExercises[exIdx].sets[setIdx];
          currentVal = currentSet.reps === 0 ? "" : currentSet.reps.toString();
        } else {
          setShouldOverwrite(false);
        }
        const newVal = currentVal + char;
        updateSet(exIdx, setIdx, "reps", newVal);
      }
    }
  };

  const handleKeypadBackspace = () => {
    if (!activeKeypad) return;
    const { exIdx, setIdx, field } = activeKeypad;
    const key = `${exIdx}_${setIdx}`;

    if (shouldOverwrite) {
      setShouldOverwrite(false);
      if (field === "weight") {
        updateSet(exIdx, setIdx, "weight", "");
      } else {
        const foundEx = exercisesCatalog.find(c => c.id === activeExercises[exIdx].exerciseId);
        const isDuration = foundEx ? foundEx.equipment.toLowerCase().includes("durata") : false;
        if (isDuration) {
          handleTimeInputChange(exIdx, setIdx, "");
        } else {
          updateSet(exIdx, setIdx, "reps", "");
        }
      }
      return;
    }

    if (field === "weight") {
      const currentVal = weightInputs[key] || "";
      const newVal = currentVal.slice(0, -1);
      updateSet(exIdx, setIdx, "weight", newVal);
    } else {
      const foundEx = exercisesCatalog.find(c => c.id === activeExercises[exIdx].exerciseId);
      const isDuration = foundEx ? foundEx.equipment.toLowerCase().includes("durata") : false;

      if (isDuration) {
        const currentVal = timeInputs[key] || "";
        const clean = currentVal.replace(":", "");
        const newVal = clean.slice(0, -1);
        
        let formatted = newVal;
        if (newVal.length > 2) {
          formatted = newVal.slice(0, newVal.length - 2) + ":" + newVal.slice(newVal.length - 2);
        }
        handleTimeInputChange(exIdx, setIdx, formatted);
      } else {
        const currentSet = activeExercises[exIdx].sets[setIdx];
        const currentVal = currentSet.reps === 0 ? "" : currentSet.reps.toString();
        const newVal = currentVal.slice(0, -1);
        updateSet(exIdx, setIdx, "reps", newVal);
      }
    }
  };

  const handleKeypadAdjust = (direction: "up" | "down") => {
    if (!activeKeypad) return;
    const { exIdx, setIdx, field } = activeKeypad;
    
    if (field === "weight") {
      const foundEx = exercisesCatalog.find(c => c.id === activeExercises[exIdx].exerciseId);
      const step = getWeightStep(foundEx?.equipment || "");
      adjustWeight(exIdx, setIdx, direction === "up" ? step : -step);
      setShouldOverwrite(true); // highlight again after step adjust!
      setKeypadHighlightTrigger((prev) => prev + 1);
    } else {
      const foundEx = exercisesCatalog.find(c => c.id === activeExercises[exIdx].exerciseId);
      const isDuration = foundEx ? foundEx.equipment.toLowerCase().includes("durata") : false;
      const step = isDuration ? 10 : 1;
      adjustReps(exIdx, setIdx, direction === "up" ? step : -step);
      setShouldOverwrite(true); // highlight again after step adjust!
      setKeypadHighlightTrigger((prev) => prev + 1);
    }
  };

  // Toggle set completion and trigger rest timer
  const toggleSetComplete = (exIdx: number, setIdx: number) => {
    const key = `${exIdx}_${setIdx}`;
    const isNowComplete = !completedSets[key];
    
    setCompletedSets((prev) => ({
      ...prev,
      [key]: isNowComplete,
    }));

    if (isNowComplete) {
      // Auto-populate empty sets with inherited values
      const currentSet = activeExercises[exIdx].sets[setIdx];
      const { inheritedWeight, inheritedReps } = getInheritedValues(exIdx, setIdx);
      let updatedWeight = currentSet.weight;
      let updatedReps = currentSet.reps;
      let needsUpdate = false;

      if (currentSet.weight === 0 && inheritedWeight > 0) {
        updatedWeight = inheritedWeight;
        needsUpdate = true;
        
        const formattedWeight = inheritedWeight.toString().replace(".", ",");
        setWeightInputs((prev) => ({
          ...prev,
          [key]: formattedWeight,
        }));
      }

      if (currentSet.reps === 0 && inheritedReps > 0) {
        updatedReps = inheritedReps;
        needsUpdate = true;

        const foundEx = exercisesCatalog.find(c => c.id === activeExercises[exIdx].exerciseId);
        const isDuration = foundEx ? foundEx.equipment.toLowerCase().includes("durata") : false;
        if (isDuration) {
          const formattedTime = secondsToHHMMSS(inheritedReps);
          setTimeInputs((prev) => ({
            ...prev,
            [key]: formattedTime,
          }));
        }
      }

      if (needsUpdate) {
        setActiveExercises((prev) => {
          const copy = JSON.parse(JSON.stringify(prev));
          copy[exIdx].sets[setIdx].weight = updatedWeight;
          copy[exIdx].sets[setIdx].reps = updatedReps;
          return copy;
        });
      }

      // Start rest timer with background-resilient end timestamp
      const exerciseRest = activeExercises[exIdx]?.restSeconds;
      const duration = exerciseRest && exerciseRest > 0 ? exerciseRest : defaultRestSeconds;
      setActiveRestTotalDuration(duration);
      setRestTimeLeft(duration);
      setIsRestPaused(false);
      setRestEndTime(Date.now() + duration * 1000);
      setRestingSetKey(key); // Set active resting set

      // Automatically launch native iPhone Timer with the exercise's exact rest seconds
      triggerIOSNativeTimer(duration);
    } else {
      if (restingSetKey === key) {
        setRestingSetKey(null);
        setRestTimeLeft(0);
        setRestEndTime(null);
      }
    }
  };

  const adjustRestTimer = (seconds: number) => {
    setRestTimeLeft((prev) => {
      const nextVal = Math.max(0, prev + seconds);
      
      if (nextVal <= 0) {
        setRestEndTime(null);
        setRestingSetKey(null);
        return 0;
      }

      if (!isRestPaused) {
        setRestEndTime(Date.now() + nextVal * 1000);
      }

      return nextVal;
    });

    setActiveRestTotalDuration((prev) => Math.max(15, prev + seconds));

    // If resting for a specific exercise, update that exercise's custom rest timer!
    if (restingSetKey) {
      const parts = restingSetKey.split("_");
      const eIdx = parseInt(parts[0], 10);
      if (activeExercises[eIdx]) {
        const currentRest = activeExercises[eIdx].restSeconds || defaultRestSeconds;
        const nextExerciseRest = Math.max(15, currentRest + seconds);
        setActiveExercises((prev) => {
          const copy = [...prev];
          if (copy[eIdx]) {
            copy[eIdx] = { ...copy[eIdx], restSeconds: nextExerciseRest };
          }
          return copy;
        });
        storage.setExerciseRestSeconds(activeExercises[eIdx].exerciseId, nextExerciseRest);
      }
    } else {
      // Save adjusted duration as the new default rest duration
      setDefaultRestSeconds((prev) => {
        const nextDefault = Math.max(15, prev + seconds);
        if (typeof window !== "undefined") {
          localStorage.setItem("default_rest_seconds", nextDefault.toString());
        }
        return nextDefault;
      });
    }
  };

  const getExerciseVolumeDelta = (exerciseId: string, currentVolume: number, isDuration = false, exerciseName = ""): { percent: string; isPositive: boolean; isNeutral: boolean } | null => {
    const sessions = storage.getHistory();
    // Search from newest to oldest for the most recent session containing this exercise
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const foundEx = session.exercises.find((e) => 
        e.exerciseId === exerciseId || 
        (exerciseName && e.exerciseName.toLowerCase().trim() === exerciseName.toLowerCase().trim())
      );
      if (foundEx && foundEx.sets && foundEx.sets.length > 0) {
        const prevVol = foundEx.sets.reduce((sum, s) => sum + calculateSetVolume(s.weight, s.reps, s.type, isDuration), 0);
        if (prevVol === 0) return null;
        const diff = currentVolume - prevVol;
        const pct = (diff / prevVol) * 100;
        return {
          percent: pct >= 0 ? `+${pct.toFixed(0)}%` : `${pct.toFixed(0)}%`,
          isPositive: pct > 0,
          isNeutral: Math.abs(pct) < 0.1,
        };
      }
    }
    return null;
  };

  const cycleSetType = (exIdx: number, setIdx: number) => {
    setActiveExercises((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const set = copy[exIdx].sets[setIdx];
      const currentType = set.type || "N";
      let nextType = "N";
      if (currentType === "N") nextType = "W";
      else if (currentType === "W") nextType = "F";
      else if (currentType === "F") nextType = "D";
      else nextType = "N";
      
      set.type = nextType;
      return copy;
    });
    setShouldOverwrite(true); // Focus highlight active set input
  };

  const handleTimeInputChange = (exIdx: number, setIdx: number, val: string) => {
    const key = `${exIdx}_${setIdx}`;
    setTimeInputs((prev) => ({
      ...prev,
      [key]: val,
    }));
    
    // Parse to seconds and update the actual set object
    const seconds = hhmmssToSeconds(val);
    setActiveExercises((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[exIdx].sets[setIdx].reps = seconds;
      return copy;
    });
  };

  const handleTimeInputBlur = (exIdx: number, setIdx: number, val: string) => {
    const key = `${exIdx}_${setIdx}`;
    const seconds = hhmmssToSeconds(val);
    const formatted = secondsToHHMMSS(seconds);
    setTimeInputs((prev) => ({
      ...prev,
      [key]: formatted,
    }));
    
    setActiveExercises((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[exIdx].sets[setIdx].reps = seconds;
      return copy;
    });
  };

  // Add Exercise to Session
  const selectExercise = (ex: Exercise) => {
    setActiveExercises((prev) => {
      // Check if already in workout to avoid duplicate cards
      if (prev.some((p) => p.exerciseId === ex.id)) {
        setIsAddExerciseOpen(false);
        return prev;
      }
      return [
        ...prev,
        {
          exerciseId: ex.id,
          exerciseName: ex.name,
          sets: [{ weight: 0, reps: 0, setOrder: 1 }],
          restSeconds: storage.getExerciseRestSeconds(ex.id, defaultRestSeconds),
        },
      ];
    });
    setIsAddExerciseOpen(false);
    setSearchQuery("");
  };

  // Remove Exercise from Session
  const removeExercise = (exIdx: number) => {
    setActiveExercises((prev) => prev.filter((_, idx) => idx !== exIdx));
  };

  // Reorder Exercises in Active Workout
  const moveExercise = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeExercises.length) return;

    setActiveExercises((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });

    // Remap keys in completedSets, weightInputs, timeInputs
    const remapKeys = <T,>(record: Record<string, T>): Record<string, T> => {
      const updated: Record<string, T> = {};
      Object.entries(record).forEach(([k, v]) => {
        const parts = k.split("_");
        if (parts.length >= 2) {
          const eIdx = parseInt(parts[0], 10);
          const sIdx = parts.slice(1).join("_");
          if (eIdx === index) {
            updated[`${targetIndex}_${sIdx}`] = v;
          } else if (eIdx === targetIndex) {
            updated[`${index}_${sIdx}`] = v;
          } else {
            updated[k] = v;
          }
        } else {
          updated[k] = v;
        }
      });
      return updated;
    };

    setCompletedSets((prev) => remapKeys(prev));
    setWeightInputs((prev) => remapKeys(prev));
    setTimeInputs((prev) => remapKeys(prev));

    if (restingSetKey) {
      const parts = restingSetKey.split("_");
      if (parts.length >= 2) {
        const eIdx = parseInt(parts[0], 10);
        const sIdx = parts.slice(1).join("_");
        if (eIdx === index) {
          setRestingSetKey(`${targetIndex}_${sIdx}`);
        } else if (eIdx === targetIndex) {
          setRestingSetKey(`${index}_${sIdx}`);
        }
      }
    }

    if (activeKeypad) {
      if (activeKeypad.exIdx === index) {
        setActiveKeypad((prev) => (prev ? { ...prev, exIdx: targetIndex } : null));
      } else if (activeKeypad.exIdx === targetIndex) {
        setActiveKeypad((prev) => (prev ? { ...prev, exIdx: index } : null));
      }
    }
  };

  const handleFinishWorkout = async () => {
    // If the session token could not be refreshed by NextAuth rotation
    if (session && (session as { error?: string }).error === "RefreshAccessTokenError") {
      setIsSyncing(true);
      setSyncStatus("error");
      setSyncErrorMsg("Sessione Google scaduta. Scollegati dal tuo profilo nella scheda 'Storico' ed esegui nuovamente l'accesso per ripristinare il collegamento.");
      return;
    }

    // If user is logged in with Google and has accessToken, run the remote sync first!
    if (session && (session as { accessToken?: string }).accessToken) {
      setIsSyncing(true);
      setSyncStatus("syncing");
      setSyncErrorMsg("");

      try {
        const response = await fetch("/api/sheets/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workoutName: workoutName.trim() || editedWorkoutName.trim(),
            exercises: activeExercises,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setSyncStatus("success");
          // Wait 1.5 seconds so they can see the success badge before local completion
          setTimeout(() => {
            setIsSyncing(false);
            setSyncStatus(null);
            finishWorkout();
          }, 1500);
        } else {
          setSyncStatus("error");
          const errMsg = data.error || "Errore sconosciuto di sincronizzazione.";
          if (response.status === 401) {
            setSyncErrorMsg("Sessione Google scaduta. Re-indirizzamento automatico per l'accesso sicuro...");
            setTimeout(() => {
              signIn("google", { callbackUrl: window.location.href });
            }, 1800);
          } else if (response.status === 403 || errMsg.toLowerCase().includes("permission") || errMsg.toLowerCase().includes("insufficient")) {
            setSyncErrorMsg("Permessi Google insufficienti. Scollegati dal profilo nella scheda 'Storico', accedi di nuovo ed ASSICURATI DI SPUNTARE le caselle dei permessi per Drive e Fogli Google.");
          } else {
            setSyncErrorMsg(errMsg);
          }
        }
      } catch {
        setSyncStatus("error");
        setSyncErrorMsg("Connessione di rete fallita. Controlla la tua connessione.");
      }
    } else {
      // Not logged in with Google, save locally immediately
      finishWorkout();
    }
  };

  // Handle Safety Cancel logic (confirm if > 5 minutes)
  const handleCancelWorkout = () => {
    if (durationSeconds > 300) {
      if (confirm("Sei sicuro di voler eliminare questo allenamento? Tutti i dati andranno persi.")) {
        cancelWorkout();
      }
    } else {
      cancelWorkout();
    }
  };

  // Swipe to delete handlers
  const handleSwipeStart = (e: React.TouchEvent, setKey: string) => {
    swipeStartX.current = e.touches[0].clientX;
    setSwipingSetKey(setKey);
    setSwipeOffset(0);
  };

  const handleSwipeMove = (e: React.TouchEvent, setKey: string) => {
    if (swipingSetKey !== setKey) return;
    const diffX = e.touches[0].clientX - swipeStartX.current;
    const offset = Math.max(0, -diffX);
    setSwipeOffset(offset);
  };

  const handleSwipeEnd = (exIdx: number, setIdx: number, setKey: string, rowWidth: number) => {
    if (swipingSetKey !== setKey) return;
    if (swipeOffset > rowWidth * 0.5) {
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([15, 10, 15]);
      }
      removeSet(exIdx, setIdx);
    }
    setSwipingSetKey(null);
    setSwipeOffset(0);
  };

  const handleCreateCustomExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const finalEquipment = newEquipment === "Bilanciere"
      ? (newBarbellPreset === "Personalizzato" ? `Bilanciere - ${newCustomBarbellText || "Olimpico"}` : `Bilanciere - ${newBarbellPreset}`)
      : newEquipment;

    const newEx = storage.addExercise(newName, newMuscleGroup, finalEquipment);
    
    // Refresh catalog lists
    const updatedExercises = storage.getExercises();
    setCatalog(updatedExercises);
    setExercisesCatalog(updatedExercises);
    
    // Automatically select the newly created exercise in the active selection
    setActiveExercises((prev) => {
      if (prev.some((p) => p.exerciseId === newEx.id)) {
        return prev;
      }
      return [
        ...prev,
        {
          exerciseId: newEx.id,
          exerciseName: newEx.name,
          sets: [{ weight: 0, reps: 0, setOrder: 1 }],
          restSeconds: storage.getExerciseRestSeconds(newEx.id, defaultRestSeconds),
        },
      ];
    });
    
    // Reset Form & Close Modals
    setNewName("");
    setNewMuscleGroup("Petto");
    setNewEquipment("Bilanciere");
    setNewBarbellPreset("Olimpico (20 kg)");
    setNewCustomBarbellText("");
    setIsCreateModalOpen(false);
    setIsAddExerciseOpen(false);
  };

  const filteredCatalog = catalog.filter((ex) =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Minimized Bottom Floating Bar */}
      {isMinimized && (
        <div 
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-20 left-4 right-4 h-16 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/10 flex items-center justify-between px-4 shadow-[0_10px_30px_rgba(0,0,0,0.15)] z-[49] cursor-pointer hover:bg-white/90 dark:hover:bg-zinc-900/90 active:scale-[0.98] transition-all duration-200 animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="relative flex h-3.5 w-3.5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-primary shadow-sm shadow-primary/40"></span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">Allenamento Attivo</span>
              <span className="text-sm font-extrabold text-primary leading-tight mt-1">{workoutName}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono font-bold text-secondary bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-full">{formatTime(durationSeconds)}</span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
              }}
              className="bg-primary hover:bg-primary/95 text-white text-xs font-extrabold px-3.5 py-2 rounded-full transition-all duration-200 active:scale-95 shadow-sm shadow-primary/20"
            >
              Apri
            </button>
          </div>
        </div>
      )}

      <div 
        className="fixed inset-0 z-[100] flex flex-col bg-white/40 dark:bg-black/60 backdrop-blur-2xl"
        style={{
          transform: !hasEntered
            ? "translateY(100%)"
            : isMinimized 
              ? "translateY(100%)" 
              : dragOffset > 0 
                ? `translateY(${dragOffset}px)` 
                : "translateY(0)",
          transition: isDragging.current ? "none" : "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease",
          pointerEvents: isMinimized ? "none" : "auto",
          visibility: (isMinimized && dragOffset === 0) ? "hidden" : "visible",
        }}
      >
      {/* Click-outside backdrop for Quick Menu */}
      {isQuickMenuOpen && (
        <div
          className="fixed inset-0 z-[25]"
          onClick={() => setIsQuickMenuOpen(false)}
          onTouchStart={() => setIsQuickMenuOpen(false)}
        />
      )}

      {/* Grab-Handle Header with Drag-to-Minimize gesture */}
      <header 
        onTouchStart={handleHeaderTouchStart}
        onTouchMove={handleHeaderTouchMove}
        onTouchEnd={handleHeaderTouchEnd}
        className="glass-header z-30 flex flex-col items-center px-4 pt-2.5 pb-3 relative cursor-grab active:cursor-grabbing border-b border-black/[0.06] dark:border-white/[0.08]"
      >
        {/* iOS-Style Pill Handle Indicator */}
        <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700/90 mb-2.5"></div>
        
        <div className="w-full flex justify-between items-center">
          <button 
            onClick={handleCancelWorkout} 
            className="text-red-500 hover:text-red-600 font-semibold active:opacity-60 transition-opacity text-[15px]"
          >
            Annulla
          </button>
          
          <div className="flex flex-col items-center">
            <button 
              type="button"
              onClick={() => {
                setEditedWorkoutName(workoutName);
                setIsEditNameModalOpen(true);
              }}
              className="flex items-center gap-1.5 text-foreground font-extrabold text-[16px] leading-tight tracking-tight active:scale-95 transition-transform group cursor-pointer"
              title="Tocca per modificare il nome dell'allenamento / Settimana"
            >
              <span>{workoutName}</span>
              <span className="w-5 h-5 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-zinc-400 group-hover:text-primary transition-colors">
                <Pencil size={11} />
              </span>
            </button>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1.5 bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.08] px-2.5 py-0.5 rounded-full shadow-inner">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-secondary font-mono text-xs font-bold">{formatTime(durationSeconds)}</span>
              </div>
            </div>

            {/* Quick Week Selector S1..S6 */}
            <div className="flex items-center gap-1 mt-1.5">
              {["S1", "S2", "S3", "S4", "S5", "S6"].map((wk) => {
                const isSelected = (workoutName || editedWorkoutName).toUpperCase().includes(wk) || 
                  (!/\b[sSwW]\s*[1-6]\b/i.test(workoutName || editedWorkoutName) && wk === "S1");
                return (
                  <button
                    key={wk}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      let base = (workoutName || editedWorkoutName).trim();
                      if (/\b[sSwW]\s*[1-6]\b/i.test(base)) {
                        base = base.replace(/\b[sSwW]\s*[1-6]\b/i, wk);
                      } else {
                        base = base ? `${base} ${wk}` : wk;
                      }
                      setWorkoutName(base);
                      setEditedWorkoutName(base);
                    }}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide transition-all active:scale-90 ${
                      isSelected
                        ? "bg-primary text-white shadow-sm"
                        : "bg-black/[0.04] dark:bg-white/[0.06] text-gray-500 hover:text-foreground"
                    }`}
                  >
                    {wk}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div
            className="flex items-center gap-2 relative"
            onTouchStart={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsQuickMenuOpen((prev) => !prev);
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer border ${
                isQuickMenuOpen
                  ? "bg-primary text-white border-primary shadow-md shadow-primary/25 scale-95"
                  : "bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.09] dark:hover:bg-white/[0.14] text-foreground border-black/[0.05] dark:border-white/[0.08]"
              }`}
              title="Azioni rapide"
              aria-label="Menu azioni rapide"
            >
              <MoreHorizontal size={17} className="stroke-[2.4px]" />
            </button>

            <button 
              onClick={handleFinishWorkout} 
              className="bg-primary hover:bg-primary/95 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md shadow-primary/20 active:scale-95 transition-all duration-200"
            >
              Fine
            </button>

            {/* Dynamic iOS Pull-Down Menu */}
            {isQuickMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="ios-dropdown-menu absolute right-0 top-11 z-[130] w-56 rounded-[22px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl border border-black/[0.08] dark:border-white/[0.12] shadow-[0_18px_45px_rgba(0,0,0,0.22)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.6)] overflow-hidden py-1.5"
              >
                <div className="px-3.5 py-1.5 border-b border-black/[0.05] dark:border-white/[0.07]">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Collegamenti Rapidi
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsQuickMenuOpen(false);
                    window.location.href = "spotify:";
                    setTimeout(() => {
                      window.open("https://open.spotify.com", "_blank");
                    }, 500);
                  }}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] transition-colors cursor-pointer text-left"
                >
                  <div className="flex flex-col">
                    <span className="text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                      Spotify
                    </span>
                    <span className="text-[10.5px] text-zinc-400 dark:text-zinc-500 font-medium">
                      Apri player musicale
                    </span>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-[#1DB954]/15 text-[#1DB954] flex items-center justify-center shrink-0">
                    <SpotifyLogo size={16} />
                  </span>
                </button>

                <div className="h-px bg-black/[0.05] dark:bg-white/[0.06] mx-3.5" />

                <button
                  type="button"
                  onClick={() => {
                    setIsQuickMenuOpen(false);
                    window.location.href = "googlesheets:";
                    setTimeout(() => {
                      window.open("https://docs.google.com/spreadsheets", "_blank");
                    }, 500);
                  }}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] transition-colors cursor-pointer text-left"
                >
                  <div className="flex flex-col">
                    <span className="text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                      Google Fogli
                    </span>
                    <span className="text-[10.5px] text-zinc-400 dark:text-zinc-500 font-medium">
                      Apri Scheda Cata 20
                    </span>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-[#0F9D58]/15 flex items-center justify-center shrink-0">
                    <GoogleSheetsLogo size={16} />
                  </span>
                </button>

                <div className="h-px bg-black/[0.05] dark:bg-white/[0.06] mx-3.5" />

                <button
                  type="button"
                  onClick={() => {
                    setIsQuickMenuOpen(false);
                    const secondsToStart = restTimeLeft > 0 ? restTimeLeft : defaultRestSeconds;
                    triggerIOSNativeTimer(secondsToStart);
                  }}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] transition-colors cursor-pointer text-left"
                >
                  <div className="flex flex-col">
                    <span className="text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                      Timer iPhone
                    </span>
                    <span className="text-[10.5px] text-zinc-400 dark:text-zinc-500 font-medium">
                      Avvia timer ({formatRestDuration(restTimeLeft > 0 ? restTimeLeft : defaultRestSeconds)})
                    </span>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-[#FF9500]/15 text-[#FF9500] flex items-center justify-center shrink-0">
                    <Timer size={16} className="stroke-[2.3px]" />
                  </span>
                </button>

                <div className="h-px bg-black/[0.05] dark:bg-white/[0.06] mx-3.5" />

                <a
                  href="/StrongVMAX%20Timer.shortcut"
                  download="StrongVMAX Timer.shortcut"
                  onClick={() => setIsQuickMenuOpen(false)}
                  className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] dark:active:bg-white/[0.1] transition-colors cursor-pointer text-left"
                >
                  <div className="flex flex-col">
                    <span className="text-[12px] font-semibold text-primary leading-tight">
                      Configura Timer iOS
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                      Installa Comando Rapido (1 tap)
                    </span>
                  </div>
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Download size={14} className="stroke-[2.3px]" />
                  </span>
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Exercises Scroll List */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 transition-all duration-300 ${activeKeypad ? "pb-[320px]" : "pb-28"}`}>
        {activeExercises.map((ex, exIdx) => {
          const foundEx = exercisesCatalog.find(c => c.id === ex.exerciseId);
          const isDuration = foundEx ? foundEx.equipment.toLowerCase().includes("durata") : false;

          return (
            <div key={ex.exerciseId} className="rounded-[26px] bg-white/75 dark:bg-zinc-900/75 backdrop-blur-2xl border border-black/[0.04] dark:border-white/[0.08] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)] overflow-hidden transition-all duration-300">
              <div className="px-4 pt-4 pb-3 border-b border-black/[0.04] dark:border-white/[0.06] flex justify-between items-start gap-2 bg-black/[0.015] dark:bg-white/[0.02]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedHistoryExercise({ id: ex.exerciseId, name: ex.exerciseName })}
                      className="flex items-center gap-1.5 active:scale-95 transition-transform group text-left cursor-pointer"
                      title="Tocca per vedere lo storico delle settimane precedenti"
                    >
                      <h2 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-50 group-hover:text-primary transition-colors tracking-tight">
                        {ex.exerciseName}
                      </h2>
                      <span className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/15 px-2 py-0.5 rounded-full border border-primary/20 flex items-center gap-1 transition-all">
                        <History size={10} className="stroke-[2.5px]" /> Storico
                      </span>
                    </button>

                    {/* Custom Exercise Rest Timer Chip */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTimerExerciseIdx(exIdx);
                        setTempTimerSeconds(ex.restSeconds || storage.getExerciseRestSeconds(ex.exerciseId, defaultRestSeconds));
                        setIsCustomTimerModalOpen(true);
                      }}
                      className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/25 flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                      title="Personalizza tempo di recupero per questo esercizio"
                    >
                      <Timer size={10} className="stroke-[2.5px]" />
                      <span>{formatRestDuration(ex.restSeconds || storage.getExerciseRestSeconds(ex.exerciseId, defaultRestSeconds))}</span>
                    </button>

                    {/* Target Reps Badge */}
                    {ex.targetReps && (
                      <span 
                        className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/25 flex items-center gap-1"
                        title="Obiettivo ripetizioni per la routine"
                      >
                        🎯 {ex.targetReps} reps
                      </span>
                    )}

                    {/* Target RPE Badge */}
                    {ex.targetRpe && (
                      <span 
                        className="text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/25 flex items-center gap-1"
                        title="Obiettivo RPE per la routine"
                      >
                        @{ex.targetRpe} RPE
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {isDuration ? (
                      <>
                        <span className="text-[11px] font-medium">Durata: <span className="font-bold text-zinc-800 dark:text-zinc-200">{secondsToHHMMSS(ex.sets.reduce((sum, s) => sum + s.reps, 0)) || "00:00"}</span></span>
                        {ex.sets.some(s => s.weight > 0) && (
                          <span className="text-[11px] font-medium">Zavorra max: <span className="font-bold text-zinc-800 dark:text-zinc-200">{Math.max(...ex.sets.map(s => s.weight))} kg</span></span>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-medium">
                          Volume: <span className="font-bold text-zinc-800 dark:text-zinc-200">{ex.sets.reduce((sum, s) => sum + calculateSetVolume(s.weight, s.reps, s.type, isDuration), 0)} kg</span>
                        </span>
                        {(() => {
                          const currentVolume = ex.sets.reduce((sum, s) => sum + calculateSetVolume(s.weight, s.reps, s.type, isDuration), 0);
                          const delta = getExerciseVolumeDelta(ex.exerciseId, currentVolume, isDuration, ex.exerciseName);
                          if (!delta) return null;
                          return (
                            <span className={`inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md font-sans leading-none tracking-tight ${
                              delta.isNeutral
                                ? "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 dark:text-zinc-400"
                                : delta.isPositive 
                                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 dark:text-emerald-400" 
                                  : "bg-rose-500/10 text-rose-600 border border-rose-500/25 dark:text-rose-400"
                            }`}>
                              {delta.isNeutral ? "●" : delta.isPositive ? "▲" : "▼"} {delta.percent}
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Header Actions: Segmented Up/Down & Delete */}
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-xl p-0.5 border border-black/5 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => moveExercise(exIdx, "up")}
                      disabled={exIdx === 0}
                      className={`p-1.5 rounded-lg transition-all active:scale-90 ${
                        exIdx === 0
                          ? "opacity-20 cursor-not-allowed text-zinc-400"
                          : "text-zinc-600 dark:text-zinc-300 hover:bg-white/80 dark:hover:bg-zinc-700/80 cursor-pointer shadow-sm"
                      }`}
                      title="Sposta esercizio su"
                      aria-label="Sposta esercizio su"
                    >
                      <ChevronUp size={14} className="stroke-[2.5px]" />
                    </button>

                    <div className="w-[1px] h-3.5 bg-black/10 dark:bg-white/10 mx-0.5" />

                    <button
                      type="button"
                      onClick={() => moveExercise(exIdx, "down")}
                      disabled={exIdx === activeExercises.length - 1}
                      className={`p-1.5 rounded-lg transition-all active:scale-90 ${
                        exIdx === activeExercises.length - 1
                          ? "opacity-20 cursor-not-allowed text-zinc-400"
                          : "text-zinc-600 dark:text-zinc-300 hover:bg-white/80 dark:hover:bg-zinc-700/80 cursor-pointer shadow-sm"
                      }`}
                      title="Sposta esercizio giù"
                      aria-label="Sposta esercizio giù"
                    >
                      <ChevronDown size={14} className="stroke-[2.5px]" />
                    </button>
                  </div>

                  <button 
                    onClick={() => removeExercise(exIdx)}
                    className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl active:scale-90 transition-all cursor-pointer"
                    aria-label="Rimuovi esercizio"
                    title="Elimina esercizio"
                  >
                    <Trash2 size={15} className="stroke-[2px]" />
                  </button>
                </div>
              </div>

              <div className="px-3.5 py-3">
                {/* Custom CSS Grid table for absolute smooth swipe gestures */}
                <div className="w-full text-sm">
                  {/* Grid Header */}
                  <div className="grid grid-cols-[38px_1fr_42px_1fr_42px] items-center text-zinc-400 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-wider pb-2 px-1">
                    <span className="text-left pl-1">SERIE</span>
                    <span className="text-center">{isDuration ? "+ KG" : "KG"}</span>
                    <span className="text-center">RPE</span>
                    <span className="text-center">{isDuration ? "TEMPO" : "REPS"}</span>
                    <span className="text-center">✓</span>
                  </div>

                  {/* Grid Body */}
                  <div className="space-y-1.5">
                    {ex.sets.flatMap((set, setIdx) => {
                      const setKey = `${exIdx}_${setIdx}`;
                      const isDone = completedSets[setKey] || false;
                      const displayWeight = weightInputs[setKey] !== undefined 
                        ? weightInputs[setKey] 
                        : (set.weight === 0 ? "" : set.weight.toString().replace(".", ","));
                      
                      const isSwipingThis = swipingSetKey === setKey;
                      const currentOffset = isSwipingThis ? swipeOffset : 0;

                      // Compute dynamic placeholders for weight & reps based on inherited preceding values
                      const { inheritedWeight, inheritedReps } = getInheritedValues(exIdx, setIdx);
                      
                      let weightPlaceholder = isDuration ? "+ 0" : "0";
                      if (inheritedWeight > 0) {
                        weightPlaceholder = isDuration 
                          ? `+ ${inheritedWeight.toString().replace(".", ",")}` 
                          : inheritedWeight.toString().replace(".", ",");
                      }

                      let repsPlaceholder = "0";
                      if (isDuration) {
                        repsPlaceholder = inheritedReps > 0 ? secondsToHHMMSS(inheritedReps) : "00:00";
                      } else {
                        if (inheritedReps > 0) {
                          repsPlaceholder = inheritedReps.toString();
                        } else if (ex.targetReps) {
                          repsPlaceholder = ex.targetReps;
                        } else {
                          repsPlaceholder = "0";
                        }
                      }

                      const row = (
                        <div 
                          key={`${setIdx}-main`}
                          className="relative overflow-hidden rounded-xl"
                          onTouchStart={(e) => handleSwipeStart(e, setKey)}
                          onTouchMove={(e) => {
                            handleSwipeMove(e, setKey);
                          }}
                          onTouchEnd={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            handleSwipeEnd(exIdx, setIdx, setKey, rect.width);
                          }}
                          onTouchCancel={() => {
                            setSwipingSetKey(null);
                            setSwipeOffset(0);
                          }}
                        >
                          {/* Red Swipe Action Background Panel */}
                          <div 
                            className="absolute inset-0 bg-rose-500 rounded-xl flex items-center justify-end pr-4 text-white transition-opacity duration-200"
                            style={{
                              opacity: currentOffset > 0 ? 1 : 0
                            }}
                          >
                            <div 
                              className={`transition-all duration-200 ${
                                currentOffset > 150 ? "scale-125 text-white" : "scale-100 text-white/90"
                              }`}
                            >
                              <Trash2 size={17} className={currentOffset > 150 ? "animate-bounce" : ""} />
                            </div>
                          </div>

                          {/* Foreground Swiping Row */}
                          <div 
                            className={`grid grid-cols-[38px_1fr_42px_1fr_42px] items-center py-2 px-1 rounded-xl transition-all relative z-10 ${
                              isDone 
                                ? "bg-emerald-500/[0.05] dark:bg-emerald-500/[0.08] border border-emerald-500/25 shadow-sm" 
                                : "bg-white dark:bg-zinc-800/80 border border-black/[0.04] dark:border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                            }`}
                            style={{
                              transform: `translateX(${-currentOffset}px)`,
                              transition: isSwipingThis ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease",
                              touchAction: "pan-y"
                            }}
                          >
                             {/* Serie Badge (Interactive button to cycle types) */}
                             <div className="text-left pl-0.5">
                               <button
                                 type="button"
                                 onClick={() => cycleSetType(exIdx, setIdx)}
                                 className={`rounded-lg w-7 h-7 text-[12px] font-bold font-mono flex items-center justify-center active:scale-90 transition-all ${
                                   set.type === "W"
                                     ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                     : set.type === "F"
                                       ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                       : set.type === "D"
                                         ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                                         : "bg-zinc-100 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300 border border-black/[0.03] dark:border-white/[0.05]"
                                 }`}
                                 title="Tipo di serie: Normale, Warmup (W), Cedimento (F), Dropset (D)"
                               >
                                 {set.type === "W" ? "W" : set.type === "F" ? "F" : set.type === "D" ? "D" : set.setOrder}
                               </button>
                             </div>
                             
                             {/* Weight Column: Apple Capsule Pill Input */}
                             <div className="px-1">
                               <div className="bg-zinc-100/80 dark:bg-zinc-900/70 hover:bg-zinc-200/60 dark:hover:bg-zinc-900 transition-all rounded-xl flex items-center justify-between px-2.5 py-1.5 border border-black/[0.04] dark:border-white/[0.06] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 w-full relative z-20">
                                 <input 
                                   type="text" 
                                   id={`input_${exIdx}_${setIdx}_weight`}
                                   inputMode="none" // blocks native keyboard
                                   value={displayWeight}
                                   placeholder={weightPlaceholder}
                                   onFocus={() => {
                                     setActiveKeypad({ exIdx, setIdx, field: "weight" });
                                     setShouldOverwrite(true);
                                   }}
                                   onChange={(e) => updateSet(exIdx, setIdx, "weight", e.target.value)}
                                   onBlur={(e) => handleWeightInputBlur(exIdx, setIdx, e.target.value)}
                                   className="w-full bg-transparent text-center font-bold text-[16px] focus:outline-none text-zinc-900 dark:text-zinc-100 caret-primary placeholder:text-zinc-300 dark:placeholder:text-zinc-600" 
                                 />
                                 <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold select-none pr-0.5 uppercase">kg</span>
                               </div>
                             </div>

                             {/* RPE Column (RPE button) */}
                             <div className="text-center">
                               <button 
                                 type="button"
                                 onClick={() => setRpePickerState({ exIdx, setIdx })}
                                 className={`h-7 min-w-[28px] px-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center mx-auto active:scale-90 ${
                                   set.rpe !== undefined && set.rpe > 0
                                     ? "bg-primary/15 text-primary border border-primary/25 shadow-sm scale-105" 
                                     : ex.targetRpe
                                       ? "text-violet-600 dark:text-violet-400 bg-violet-500/10 border border-violet-500/25 hover:bg-violet-500/20"
                                       : "text-zinc-400 hover:text-primary bg-zinc-100/80 dark:bg-zinc-900/70"
                                 }`}
                                 title={set.rpe !== undefined && set.rpe > 0 ? `RPE effettivo: ${set.rpe}` : ex.targetRpe ? `Target routine: @${ex.targetRpe}` : "Imposta RPE"}
                               >
                                 {set.rpe !== undefined && set.rpe > 0 
                                   ? set.rpe.toString().replace(".", ",") 
                                   : ex.targetRpe 
                                     ? `@${ex.targetRpe}` 
                                     : "@"}
                               </button>
                             </div>

                             {/* Reps or Duration Column: Apple Capsule Pill Input */}
                             <div className="px-1">
                               <div className="bg-zinc-100/80 dark:bg-zinc-900/70 hover:bg-zinc-200/60 dark:hover:bg-zinc-900 transition-all rounded-xl flex items-center justify-between px-2.5 py-1.5 border border-black/[0.04] dark:border-white/[0.06] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 w-full relative z-20">
                                 {isDuration ? (
                                   <input 
                                     type="text" 
                                     id={`input_${exIdx}_${setIdx}_reps`}
                                     inputMode="none" // blocks native keyboard
                                     value={timeInputs[`${exIdx}_${setIdx}`] !== undefined ? timeInputs[`${exIdx}_${setIdx}`] : (set.reps === 0 ? "" : secondsToHHMMSS(set.reps))}
                                     placeholder={repsPlaceholder}
                                     onFocus={() => {
                                       setActiveKeypad({ exIdx, setIdx, field: "reps" });
                                       setShouldOverwrite(true);
                                     }}
                                     onChange={(e) => handleTimeInputChange(exIdx, setIdx, e.target.value)}
                                     onBlur={(e) => handleTimeInputBlur(exIdx, setIdx, e.target.value)}
                                     className="w-full bg-transparent text-center font-bold text-[16px] font-mono focus:outline-none text-zinc-900 dark:text-zinc-100 caret-primary placeholder:text-zinc-300 dark:placeholder:text-zinc-600" 
                                   />
                                 ) : (
                                   <input 
                                     type="text" 
                                     id={`input_${exIdx}_${setIdx}_reps`}
                                     inputMode="none" // blocks native keyboard
                                     value={set.reps === 0 ? "" : set.reps}
                                     placeholder={repsPlaceholder}
                                     onFocus={() => {
                                       setActiveKeypad({ exIdx, setIdx, field: "reps" });
                                       setShouldOverwrite(true);
                                     }}
                                     onChange={(e) => updateSet(exIdx, setIdx, "reps", e.target.value)}
                                     className="w-full bg-transparent text-center font-bold text-[16px] focus:outline-none text-zinc-900 dark:text-zinc-100 caret-primary placeholder:text-zinc-300 dark:placeholder:text-zinc-600" 
                                   />
                                 )}
                                 <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold select-none pr-0.5 uppercase">
                                   {isDuration ? "sec" : "reps"}
                                 </span>
                               </div>
                             </div>

                            {/* Tick Checkbox complete button (Authentic iOS circular toggle) */}
                            <div className="text-center">
                              <button 
                                onClick={() => toggleSetComplete(exIdx, setIdx)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all duration-200 active:scale-90 ${
                                  isDone 
                                    ? "bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.35)]" 
                                    : "border-2 border-zinc-300 dark:border-zinc-700 bg-transparent hover:border-zinc-400 text-transparent"
                                }`}
                              >
                                <Check size={16} className={`stroke-[3.5px] ${isDone ? "text-white scale-100" : "opacity-0"}`} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );

                      if (restingSetKey === setKey && restTimeLeft > 0) {
                        const restBar = (
                          <div key={`${setIdx}-rest`} className="animate-in slide-in-from-top-1 duration-300 py-1">
                            <div className="relative w-full h-8 bg-zinc-900/90 dark:bg-black/90 backdrop-blur-md rounded-xl overflow-hidden shadow-inner border border-white/10 flex items-center justify-between p-0.5 text-white">
                              {/* Glowing Gradient Collapsing Rest Progress Bar */}
                              <div 
                                className="absolute top-0.5 bottom-0.5 left-0.5 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-lg shadow-[0_0_12px_rgba(16,185,129,0.35)] transition-all duration-1000 ease-linear z-0"
                                style={{ width: `calc(${(restTimeLeft / (activeRestTotalDuration || defaultRestSeconds)) * 100}% - 4px)` }}
                              />
                              
                              {/* Left Adjuster */}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  adjustRestTimer(-15);
                                }}
                                className="relative z-10 w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-[10px] font-bold active:scale-90 transition-transform ml-0.5 border border-white/10"
                                title="Sottrai 15s"
                              >
                                -15s
                              </button>

                              {/* Counter in MM:SS (Super readable, high contrast text) */}
                              <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-white font-mono tracking-wider z-10 pointer-events-none drop-shadow-sm">
                                {Math.floor(restTimeLeft / 60).toString().padStart(2, "0")}:{(restTimeLeft % 60).toString().padStart(2, "0")}
                              </div>

                              {/* Right Adjuster */}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  adjustRestTimer(15);
                                }}
                                className="relative z-10 w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-[10px] font-bold active:scale-90 transition-transform mr-0.5 border border-white/10"
                                title="Aggiungi 15s"
                              >
                                +15s
                              </button>
                            </div>
                          </div>
                        );
                        return [row, restBar];
                      }

                      return [row];
                    })}
                  </div>
                </div>

                <button 
                  onClick={() => addSet(exIdx)}
                  className="w-full mt-2.5 py-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/60 text-primary font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.99] transition-all border border-black/[0.04] dark:border-white/[0.05]"
                >
                  <Plus size={15} className="stroke-[2.5px]" /> Aggiungi Serie
                </button>
              </div>

              {/* Sensazioni / Feedback Esercizio */}
              <div className="px-4 pb-4 pt-1 flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-0.5">
                  Sensazioni Esercizio (Feedback Atleta)
                </label>
                <textarea
                  rows={3}
                  placeholder="Scrivi come ti è sembrato l'esercizio (es. fastidio spalla, RPE target, feedback...)"
                  value={ex.feedback || ""}
                  onChange={(e) => {
                    const text = e.target.value;
                    setActiveExercises((prev) => {
                      const copy = JSON.parse(JSON.stringify(prev));
                      copy[exIdx].feedback = text;
                      return copy;
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-[16px] placeholder:text-[13px] outline-none font-medium resize-none text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 bg-zinc-100/70 dark:bg-zinc-950/60 focus:bg-white dark:focus:bg-zinc-950 border border-black/[0.04] dark:border-white/[0.06] focus:border-primary/40 transition-all duration-200"
                />
              </div>
            </div>
          );
        })}

        {/* Global Add Exercise and Reorder Buttons at bottom */}
        <div className="flex gap-2.5 pt-2">
          <button 
            onClick={() => setIsAddExerciseOpen(true)}
            className="flex-1 py-4 rounded-[22px] bg-primary hover:bg-primary/95 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus size={18} className="stroke-[2.5px]" /> Aggiungi Esercizio
          </button>
          {activeExercises.length > 1 && (
            <button
              onClick={() => setIsReorderModalOpen(true)}
              className="px-5 py-4 rounded-[22px] bg-white/70 dark:bg-zinc-800/70 hover:bg-white/90 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold text-sm flex items-center justify-center gap-2 border border-black/[0.05] dark:border-white/[0.08] shadow-sm active:scale-[0.98] transition-all cursor-pointer backdrop-blur-xl"
              title="Riordina tutti gli esercizi"
            >
              <ArrowUpDown size={17} className="stroke-[2.2px]" /> Riordina
            </button>
          )}
        </div>
      </div>

      {/* Floating Rest Timer Live Activity Island */}
      {restTimeLeft > 0 && (
        <div className="fixed bottom-4 left-3 right-3 max-w-lg mx-auto z-[105] rounded-[28px] bg-zinc-900/95 dark:bg-zinc-950/95 backdrop-blur-2xl text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-white/15 px-3.5 py-3 flex items-center justify-between animate-in slide-in-from-bottom-3 duration-300">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (isRestPaused) {
                  setRestEndTime(Date.now() + restTimeLeft * 1000);
                  setIsRestPaused(false);
                } else {
                  setRestEndTime(null);
                  setIsRestPaused(true);
                }
              }}
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/10 flex items-center justify-center text-white active:scale-90 transition-all cursor-pointer shrink-0"
            >
              {isRestPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
            </button>

            <div className="flex flex-col">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400">
                Riposo
              </span>
              <span className="font-mono font-black text-2xl leading-tight text-white tracking-tight">
                {Math.floor(restTimeLeft / 60).toString().padStart(2, "0")}:
                {(restTimeLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick glassmorphic time adjusters */}
            <div className="flex items-center gap-1 bg-white/10 rounded-full p-0.5 border border-white/10">
              <button 
                onClick={() => adjustRestTimer(-15)}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/35 text-white flex items-center justify-center text-[11px] font-bold active:scale-90 transition-all cursor-pointer"
                title="Sottrai 15 secondi"
              >
                -15s
              </button>
              <button 
                onClick={() => adjustRestTimer(15)}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/35 text-white flex items-center justify-center text-[11px] font-bold active:scale-90 transition-all cursor-pointer"
                title="Aggiungi 15 secondi"
              >
                +15s
              </button>
            </div>

            <button 
              onClick={() => {
                setRestTimeLeft(0);
                setRestEndTime(null);
                setRestingSetKey(null);
              }}
              className="flex items-center gap-1 text-[11px] font-bold text-zinc-300 hover:text-white bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-2 rounded-full active:scale-95 transition-all cursor-pointer shrink-0"
            >
              Salta <FastForward size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Add Exercise Modal (Catalog Browser) */}
      {isAddExerciseOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-t-[32px] p-6 h-[82vh] flex flex-col gap-4 ios-modal-animate bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl border-t border-black/5 dark:border-white/10 shadow-2xl pb-safe">
            <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto -mt-2 mb-1" />
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Aggiungi Esercizio</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="text-xs font-bold text-primary flex items-center gap-0.5 active:scale-95 transition-transform bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-full cursor-pointer"
                >
                  <Plus size={14} /> Nuovo
                </button>
                <button 
                  onClick={() => setIsAddExerciseOpen(false)}
                  className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 active:scale-95 transition-all text-zinc-500 dark:text-zinc-400 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Cerca nel catalogo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-primary/40 transition-all"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredCatalog.map((ex) => (
                <div 
                  key={ex.id}
                  onClick={() => selectExercise(ex)}
                  className="p-3.5 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-all cursor-pointer flex justify-between items-center active:scale-[0.98]"
                >
                  <div>
                    <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{ex.name}</h4>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{ex.muscleGroup} • {ex.equipment}</span>
                  </div>
                  <Plus size={18} className="text-primary" />
                </div>
              ))}
              {filteredCatalog.length === 0 && (
                <div className="p-8 text-center text-zinc-400 dark:text-zinc-500 text-sm font-medium">
                  Nessun esercizio trovato per &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RPE Picker Sheet Overlay */}
      {rpePickerState && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-t-[32px] p-6 flex flex-col gap-4 ios-modal-animate bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl border-t border-black/5 dark:border-white/10 shadow-2xl pb-safe">
            <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto -mt-2 mb-1" />
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">Scala Sforzo RPE</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Seleziona lo sforzo percepito (da 5 a 10 con mezzi punti)</p>
              </div>
              <button 
                onClick={() => setRpePickerState(null)}
                className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 active:scale-95 transition-all text-zinc-500 dark:text-zinc-400 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2.5 py-2">
              {[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1].map((val) => {
                const currentSet = activeExercises[rpePickerState.exIdx]?.sets[rpePickerState.setIdx];
                const targetRpe = activeExercises[rpePickerState.exIdx]?.targetRpe;
                const isSelected = currentSet?.rpe === val;
                const isTarget = targetRpe === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => selectRpe(val)}
                    className={`py-3 rounded-xl text-sm font-bold border transition-all active:scale-95 relative ${
                      isSelected
                        ? "bg-primary text-white border-primary shadow-md shadow-primary/10"
                        : isTarget
                          ? "bg-violet-500/10 border-violet-500/40 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20"
                          : "bg-black/5 border-transparent text-foreground hover:bg-black/10"
                    }`}
                  >
                    {val.toString().replace(".", ",")}
                    {isTarget && !isSelected && (
                      <span className="absolute -top-1.5 -right-1 text-[8px] bg-violet-600 text-white px-1 rounded-full font-extrabold uppercase">
                        Target
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => selectRpe(undefined)}
                className="col-span-4 py-3 bg-red-50 text-red-500 border border-transparent font-bold text-sm rounded-xl active:scale-95 transition-all"
              >
                Rimuovi RPE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Exercise Modal Inline */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[160] bg-[#f5f6fa] dark:bg-zinc-950 flex flex-col p-5 ios-modal-animate pb-safe overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b border-black/5 dark:border-white/5 mb-4">
            <h2 className="text-xl font-bold font-sans text-foreground">Crea Esercizio</h2>
            <button 
              onClick={() => setIsCreateModalOpen(false)}
              className="p-2 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 active:scale-95 transition-all"
              aria-label="Chiudi"
            >
              <X size={20} className="text-foreground" />
            </button>
          </div>

          <form onSubmit={handleCreateCustomExercise} className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 pb-4">
              <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4 border border-black/5 dark:border-white/5 bg-white dark:bg-zinc-900">
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome Esercizio</label>
                  <input
                    type="text"
                    placeholder="Es. Curl concentrato, Affondi..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="glass-input w-full px-4 py-3.5 rounded-xl text-base outline-none font-medium bg-black/5 dark:bg-white/5 border-transparent text-foreground"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gruppo Muscolare</label>
                  <select
                    value={newMuscleGroup}
                    onChange={(e) => setNewMuscleGroup(e.target.value)}
                    className="glass-input w-full px-4 py-3.5 rounded-xl text-base outline-none appearance-none font-semibold bg-white dark:bg-zinc-800 text-foreground border border-black/5"
                  >
                    <option value="Petto">Petto</option>
                    <option value="Spalle">Spalle</option>
                    <option value="Schiena">Schiena</option>
                    <option value="Gambe">Gambe</option>
                    <option value="Bicipiti">Bicipiti</option>
                    <option value="Tricipiti">Tricipiti</option>
                    <option value="Core">Core</option>
                    <option value="Altro">Altro</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Attrezzatura</label>
                  <select
                    value={newEquipment}
                    onChange={(e) => setNewEquipment(e.target.value)}
                    className="glass-input w-full px-4 py-3.5 rounded-xl text-base outline-none appearance-none font-semibold bg-white dark:bg-zinc-800 text-foreground border border-black/5"
                  >
                    <option value="Bilanciere">Bilanciere</option>
                    <option value="Smith machine">Smith machine</option>
                    <option value="Carico libero (Dischi)">Carico libero (Dischi)</option>
                    <option value="Manubri">Manubri</option>
                    <option value="Macchina">Macchina</option>
                    <option value="Cavi">Cavi</option>
                    <option value="Corpo libero">Corpo libero</option>
                    <option value="Durata">Durata</option>
                    <option value="Altro">Altro</option>
                  </select>
                </div>

                {/* Dynamic Barbell Sub-options */}
                {newEquipment === "Bilanciere" && (
                  <div className="flex flex-col gap-3 p-3.5 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Specifica Bilanciere (Tendina)</label>
                      <select
                        value={newBarbellPreset}
                        onChange={(e) => setNewBarbellPreset(e.target.value)}
                        className="glass-input w-full px-4 py-3 rounded-xl text-sm outline-none appearance-none font-semibold bg-white dark:bg-zinc-800 text-foreground border border-black/5"
                      >
                        <option value="Olimpico (20 kg)">Olimpico (20 kg)</option>
                        <option value="EZ / Sagomato (8 kg)">EZ / Sagomato (8 kg)</option>
                        <option value="Standard (10 kg)">Standard (10 kg)</option>
                        <option value="Trap bar (25 kg)">Trap bar (25 kg)</option>
                        <option value="Personalizzato">Personalizzato (digita sotto)...</option>
                      </select>
                    </div>
                    {newBarbellPreset === "Personalizzato" && (
                      <div className="flex flex-col gap-1.5 text-left animate-in fade-in duration-200">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Scrivi specifica</label>
                        <input
                          type="text"
                          placeholder="Es. Sagomato, 15 kg, Svizzero..."
                          value={newCustomBarbellText}
                          onChange={(e) => setNewCustomBarbellText(e.target.value)}
                          className="glass-input w-full px-4 py-3 rounded-xl text-sm outline-none font-medium bg-black/5 dark:bg-white/5 border-transparent text-foreground"
                          required
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-primary hover:bg-primary/95 text-white font-bold text-base rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all duration-200 mt-2"
            >
              {"Crea & Aggiungi all'Allenamento"}
            </button>
          </form>
        </div>
      )}

      {/* Custom Bottom sheet Keypad Overlay */}
      {activeKeypad && (() => {
        const { exIdx, setIdx, field } = activeKeypad;
        const currentEx = activeExercises[exIdx];
        if (!currentEx) return null;
        const foundEx = exercisesCatalog.find((c) => c.id === currentEx.exerciseId);
        const isDuration = foundEx ? foundEx.equipment.toLowerCase().includes("durata") : false;
        
        return (
          <div className="fixed bottom-0 left-0 right-0 z-[120] bg-zinc-200/95 dark:bg-zinc-900/95 backdrop-blur-3xl border-t border-black/10 dark:border-white/10 shadow-[0_-12px_40px_rgba(0,0,0,0.25)] animate-in slide-in-from-bottom duration-250 pb-safe">
            {/* iOS Sheet Handle Indicator */}
            <div className="w-10 h-1 bg-zinc-400/50 dark:bg-zinc-600/50 rounded-full mx-auto mt-2 mb-1" />

            {/* Keyboard Header Bar */}
            <div className="flex justify-between items-center px-4 py-2 border-b border-black/5 dark:border-white/5">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">
                  Modifica {field === "weight" ? "Carico" : isDuration ? "Tempo" : "Ripetizioni"}
                </span>
                <span className="text-xs font-bold text-zinc-900 dark:text-white">
                  {currentEx.exerciseName} • Serie {setIdx + 1}
                </span>
              </div>
              <button 
                onClick={() => setActiveKeypad(null)}
                className="text-xs font-bold text-white bg-primary hover:bg-primary/90 px-4 py-1.5 rounded-full active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                Fatto
              </button>
            </div>

            {/* Keyboard Keys Layout */}
            <div className="p-3 grid grid-cols-5 gap-2.5 h-[235px]">
              {/* Left 80%: Numeric keys grid */}
              <div className="col-span-4 grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num)}
                    className="bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 active:bg-zinc-200 dark:active:bg-zinc-700 active:scale-95 transition-all text-zinc-900 dark:text-white font-semibold text-2xl rounded-2xl flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.1)] border border-black/[0.04] dark:border-white/[0.06] select-none cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleKeypadPress(",")}
                  className="bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700 active:scale-95 transition-all text-zinc-900 dark:text-white font-bold text-2xl rounded-2xl flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.1)] border border-black/[0.04] dark:border-white/[0.06] select-none cursor-pointer"
                >
                  ,
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress("0")}
                  className="bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 active:bg-zinc-200 dark:active:bg-zinc-700 active:scale-95 transition-all text-zinc-900 dark:text-white font-semibold text-2xl rounded-2xl flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.1)] border border-black/[0.04] dark:border-white/[0.06] select-none cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700 active:scale-95 transition-all text-zinc-900 dark:text-white font-semibold text-xl rounded-2xl flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.1)] border border-black/[0.04] dark:border-white/[0.06] select-none cursor-pointer"
                >
                  ⌫
                </button>
              </div>

              {/* Right 20%: Stepper keys column */}
              <div className="col-span-1 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleKeypadAdjust("up")}
                  className="flex-1 bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/35 active:scale-95 transition-all text-emerald-600 dark:text-emerald-400 font-bold text-2xl flex items-center justify-center rounded-2xl border border-emerald-500/30 select-none shadow-sm cursor-pointer"
                  title="Incrementa"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadAdjust("down")}
                  className="flex-1 bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 active:scale-95 transition-all text-rose-600 dark:text-rose-400 font-bold text-2xl flex items-center justify-center rounded-2xl border border-rose-500/30 select-none shadow-sm cursor-pointer"
                  title="Decrementa"
                >
                  -
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Full-Screen Glassmorphic Sync Loader Overlay */}
      {isSyncing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-panel w-11/12 max-w-sm rounded-3xl p-6 flex flex-col items-center gap-4 text-center border border-white/20 dark:border-white/10 shadow-2xl animate-in scale-in duration-200 bg-white/90 dark:bg-zinc-900/90">
            {syncStatus === "syncing" && (
              <>
                {/* Modern Spinning Indicator */}
                <div className="relative w-16 h-16 flex items-center justify-center mt-2">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <h3 className="text-base font-bold text-primary mt-2">Sincronizzazione</h3>
                <p className="text-xs text-gray-500 max-w-[240px]">
                  Stiamo aggiornando la tua **&ldquo;Scheda Cata 20&rdquo;** su Google Drive con i tuoi KG e feedback della settimana...
                </p>
              </>
            )}

            {syncStatus === "success" && (
              <>
                {/* Completed Checkmark Animation */}
                <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center border border-green-500/30 scale-in duration-300 mt-2">
                  <Check size={32} className="stroke-[3.5px] animate-bounce" />
                </div>
                <h3 className="text-base font-bold text-green-600 dark:text-green-400 mt-2">Sincronizzato!</h3>
                <p className="text-xs text-gray-500 max-w-[240px]">
                  Fogli Google aggiornato correttamente con i carichi eseguiti. Ottimo lavoro!
                </p>
              </>
            )}

            {syncStatus === "error" && (
              <>
                {/* Warning / Error Indicator */}
                <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center border border-red-500/30 scale-in duration-300 mt-2">
                  <X size={32} className="stroke-[3px]" />
                </div>
                <h3 className="text-base font-bold text-red-600 dark:text-red-400 mt-2">Errore Sincronizzazione</h3>
                <p className="text-xs text-red-500 max-w-[260px] whitespace-pre-wrap font-medium">
                  {syncErrorMsg}
                </p>
                <div className="flex flex-col gap-2 w-full mt-4">
                  <button
                    onClick={handleFinishWorkout}
                    className="w-full py-3 bg-primary text-white font-bold text-xs rounded-xl active:scale-95 transition-transform"
                  >
                    Riprova
                  </button>
                  <button
                    onClick={() => {
                      setIsSyncing(false);
                      setSyncStatus(null);
                      finishWorkout();
                    }}
                    className="w-full py-3 bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-300 font-bold text-xs rounded-xl active:scale-95 transition-transform border border-black/5 dark:border-white/5"
                  >
                    Salva Solo in Locale
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Workout Name Modal */}
      {isEditNameModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4 border border-white/20 dark:border-white/10 shadow-2xl bg-white/95 dark:bg-zinc-900/95">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-foreground">Modifica Nome Workout</h3>
              <button 
                onClick={() => setIsEditNameModalOpen(false)}
                className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 active:scale-95 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Personalizza il nome o la settimana dell&apos;allenamento (es. &ldquo;Petto Dorso S2&rdquo;):
            </p>

            <input
              type="text"
              value={editedWorkoutName}
              onChange={(e) => setEditedWorkoutName(e.target.value)}
              placeholder="Es. Petto Dorso S2..."
              className="glass-input w-full px-4 py-3 rounded-xl text-base outline-none font-semibold bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10"
              autoFocus
            />

            {/* Quick Week Chips */}
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Seleziona Settimana:</span>
              <div className="flex flex-wrap gap-1.5">
                {["S1", "S2", "S3", "S4", "S5", "S6"].map((week) => {
                  const updateWeekName = () => {
                    let base = editedWorkoutName.trim();
                    if (/\b(W|S)\d+\b/i.test(base)) {
                      base = base.replace(/\b(W|S)\d+\b/i, week);
                    } else {
                      base = base ? `${base} ${week}` : week;
                    }
                    setEditedWorkoutName(base);
                  };
                  const isActiveWeek = editedWorkoutName.includes(week);
                  return (
                    <button
                      key={week}
                      type="button"
                      onClick={updateWeekName}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                        isActiveWeek
                          ? "bg-primary text-white shadow-sm"
                          : "bg-black/5 dark:bg-white/10 hover:bg-black/10 text-foreground"
                      }`}
                    >
                      {week}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsEditNameModalOpen(false)}
                className="flex-1 py-3 rounded-xl text-xs font-bold bg-black/5 hover:bg-black/10 text-gray-500 dark:text-gray-400"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editedWorkoutName.trim()) {
                    setWorkoutName(editedWorkoutName.trim());
                  }
                  setIsEditNameModalOpen(false);
                }}
                className="flex-1 py-3 rounded-xl text-xs font-bold bg-primary text-white shadow-md shadow-primary/20 active:scale-95"
              >
                Salva Nome
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise History Sheet Modal */}
      {selectedHistoryExercise && (() => {
        const historySessions = storage.getHistory().filter((session) =>
          session.exercises.some((e) => 
            e.exerciseId === selectedHistoryExercise.id || 
            e.exerciseName.toLowerCase().trim() === selectedHistoryExercise.name.toLowerCase().trim()
          )
        );

        return (
          <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="glass-panel w-full max-w-lg rounded-t-3xl p-6 h-[80vh] flex flex-col gap-4 ios-modal-animate border-x-0 border-b-0 bg-white dark:bg-zinc-950 pb-safe">
              {/* Header */}
              <div className="flex justify-between items-center pb-2 border-b border-black/5 dark:border-white/10">
                <div>
                  <div className="flex items-center gap-1.5">
                    <History size={18} className="text-primary" />
                    <h3 className="font-bold text-lg text-foreground">Storico Esercizio</h3>
                  </div>
                  <p className="text-xs text-primary font-bold mt-0.5">{selectedHistoryExercise.name}</p>
                </div>
                <button 
                  onClick={() => setSelectedHistoryExercise(null)}
                  className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 active:scale-95 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* History List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {historySessions.length > 0 ? (
                  historySessions.map((session) => {
                    const matchedEx = session.exercises.find((e) =>
                      e.exerciseId === selectedHistoryExercise.id ||
                      e.exerciseName.toLowerCase().trim() === selectedHistoryExercise.name.toLowerCase().trim()
                    );
                    if (!matchedEx) return null;

                    const dateFormatted = new Date(session.date).toLocaleDateString("it-IT", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });

                    return (
                      <div key={session.id} className="p-4 rounded-2xl border border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs border-b border-black/5 dark:border-white/5 pb-2">
                          <span className="font-extrabold text-primary">{session.name}</span>
                          <span className="text-gray-400 font-medium capitalize">{dateFormatted}</span>
                        </div>

                        <div className="space-y-1 text-xs">
                          {matchedEx.sets.map((set, idx) => (
                            <div key={idx} className="flex justify-between items-center py-1 px-2 rounded-lg bg-white/40 dark:bg-black/30">
                              <span className="font-bold text-gray-500">Serie {set.setOrder || idx + 1} {set.type && set.type !== "N" ? `(${set.type})` : ""}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-extrabold text-foreground">{set.weight} kg × {set.reps} {set.reps === 1 ? "rep" : "reps"}</span>
                                {set.rpe && set.rpe > 0 && (
                                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/20">
                                    @{set.rpe.toString().replace(".", ",")}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {matchedEx.feedback && (
                          <div className="mt-1 pt-1 border-t border-black/5 dark:border-white/5 text-[11px] text-gray-500 italic">
                            &ldquo;{matchedEx.feedback}&rdquo;
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    Nessuna esecuzione precedente registrata nel tuo storico per {selectedHistoryExercise.name}.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Exercise Reorder Sheet / Modal */}
      {isReorderModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm glass-panel rounded-3xl p-5 shadow-2xl border border-white/20 dark:border-white/10 flex flex-col max-h-[80vh] animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <ArrowUpDown size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-foreground">Riordina Esercizi</h3>
                  <p className="text-[11px] text-gray-500">{activeExercises.length} esercizi nel workout</p>
                </div>
              </div>
              <button
                onClick={() => setIsReorderModalOpen(false)}
                className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 active:scale-95 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Exercise List */}
            <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
              {activeExercises.map((ex, idx) => (
                <div
                  key={ex.exerciseId}
                  className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-foreground truncate">{ex.exerciseName}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveExercise(idx, "up")}
                      disabled={idx === 0}
                      className={`p-2 rounded-xl border border-black/5 dark:border-white/10 transition-all active:scale-90 ${
                        idx === 0
                          ? "opacity-20 cursor-not-allowed text-gray-400"
                          : "text-zinc-700 dark:text-zinc-200 bg-white/40 dark:bg-zinc-800 hover:bg-white/60 dark:hover:bg-zinc-700 cursor-pointer"
                      }`}
                      title="Sposta su"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveExercise(idx, "down")}
                      disabled={idx === activeExercises.length - 1}
                      className={`p-2 rounded-xl border border-black/5 dark:border-white/10 transition-all active:scale-90 ${
                        idx === activeExercises.length - 1
                          ? "opacity-20 cursor-not-allowed text-gray-400"
                          : "text-zinc-700 dark:text-zinc-200 bg-white/40 dark:bg-zinc-800 hover:bg-white/60 dark:hover:bg-zinc-700 cursor-pointer"
                      }`}
                      title="Sposta giù"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setIsReorderModalOpen(false)}
              className="w-full py-3 rounded-2xl bg-primary text-white text-xs font-black shadow-md shadow-primary/25 active:scale-95 transition-all mt-2 cursor-pointer"
            >
              Fatto
            </button>
          </div>
        </div>
      )}

      {/* Custom Exercise Rest Timer Modal */}
      {isCustomTimerModalOpen && selectedTimerExerciseIdx !== null && activeExercises[selectedTimerExerciseIdx] && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm glass-panel rounded-3xl p-6 shadow-2xl border border-white/20 dark:border-white/10 flex flex-col space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                  <Timer size={12} /> Timer di Riposo
                </span>
                <h3 className="text-base font-black text-foreground mt-0.5 line-clamp-1">
                  {activeExercises[selectedTimerExerciseIdx].exerciseName}
                </h3>
              </div>
              <button
                onClick={() => setIsCustomTimerModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-foreground active:scale-90"
              >
                <X size={20} />
              </button>
            </div>

            {/* Stepper Display */}
            <div className="flex items-center justify-center gap-4 py-3 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
              <button
                onClick={() => setTempTimerSeconds((prev) => Math.max(15, prev - 15))}
                className="w-11 h-11 rounded-full bg-white dark:bg-zinc-800 shadow-md flex items-center justify-center text-sm font-black active:scale-90 transition-transform text-foreground cursor-pointer"
              >
                -15s
              </button>
              <div className="text-center min-w-[100px]">
                <div className="text-3xl font-black font-mono text-primary">
                  {Math.floor(tempTimerSeconds / 60)}:{(tempTimerSeconds % 60).toString().padStart(2, "0")}
                </div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                  {tempTimerSeconds} secondi
                </div>
              </div>
              <button
                onClick={() => setTempTimerSeconds((prev) => prev + 15)}
                className="w-11 h-11 rounded-full bg-white dark:bg-zinc-800 shadow-md flex items-center justify-center text-sm font-black active:scale-90 transition-transform text-foreground cursor-pointer"
              >
                +15s
              </button>
            </div>

            {/* Quick preset chips */}
            <div>
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Preset Rapidi</span>
              <div className="grid grid-cols-4 gap-2">
                {[30, 45, 60, 75, 90, 120, 150, 180, 240, 300].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setTempTimerSeconds(sec)}
                    className={`py-2 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer ${
                      tempTimerSeconds === sec
                        ? "bg-primary text-white shadow-md shadow-primary/30"
                        : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-foreground border border-black/5 dark:border-white/5"
                    }`}
                  >
                    {sec < 60 ? `${sec}s` : sec % 60 === 0 ? `${sec / 60}m` : `${Math.floor(sec / 60)}m ${sec % 60}s`}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCustomTimerModalOpen(false)}
                className="flex-1 py-3 rounded-2xl border border-black/10 dark:border-white/10 text-xs font-bold text-gray-500 hover:text-foreground active:scale-95 transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  const ex = activeExercises[selectedTimerExerciseIdx];
                  if (ex) {
                    setActiveExercises((prev) => {
                      const copy = [...prev];
                      copy[selectedTimerExerciseIdx] = {
                        ...copy[selectedTimerExerciseIdx],
                        restSeconds: tempTimerSeconds,
                      };
                      return copy;
                    });
                    storage.setExerciseRestSeconds(ex.exerciseId, tempTimerSeconds);

                    // If this exercise is currently resting, adjust active rest timer
                    if (restingSetKey) {
                      const parts = restingSetKey.split("_");
                      if (parseInt(parts[0], 10) === selectedTimerExerciseIdx) {
                        setActiveRestTotalDuration(tempTimerSeconds);
                        setRestTimeLeft(tempTimerSeconds);
                        setRestEndTime(Date.now() + tempTimerSeconds * 1000);
                      }
                    }
                  }
                  setIsCustomTimerModalOpen(false);
                }}
                className="flex-1 py-3 rounded-2xl bg-primary text-white text-xs font-black shadow-lg shadow-primary/25 active:scale-95 transition-all cursor-pointer"
              >
                Salva Timer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </>
);
}
