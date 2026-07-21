"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWorkout } from "@/context/WorkoutContext";
import { Check, Play, Pause, FastForward, Plus, Trash2, X, Pencil, History } from "lucide-react";
import { storage, Exercise, calculateSetVolume } from "@/utils/storage";
import { useSession, signIn } from "next-auth/react";
import { gymChime } from "@/utils/audio";

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

  // Keep alive in background state
  const [keepAlive, setKeepAlive] = useState(false);

  // Edit Workout Name Modal State
  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
  const [editedWorkoutName, setEditedWorkoutName] = useState("");

  // Exercise History Modal State
  const [selectedHistoryExercise, setSelectedHistoryExercise] = useState<{ id: string; name: string } | null>(null);

  // Rest Timer State
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [isRestPaused, setIsRestPaused] = useState(false);
  const [restEndTime, setRestEndTime] = useState<number | null>(null);
  const [completedSets, setCompletedSets] = useState<Record<string, boolean>>({});
  const [defaultRestSeconds, setDefaultRestSeconds] = useState(90);

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
        const storedKeepAlive = localStorage.getItem("keep_alive_in_background") === "true";
        setKeepAlive(storedKeepAlive);
      }
    }
  }, [isActive]);

  // Load catalog on mount/open
  useEffect(() => {
    if (isAddExerciseOpen) {
      setCatalog(storage.getExercises());
    }
  }, [isAddExerciseOpen]);

  // Unlock Web Audio API on first interaction when workout starts
  useEffect(() => {
    if (isActive) {
      const unlockAudio = () => {
        gymChime.unlock();
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
        window.removeEventListener("click", unlockAudio);
        window.removeEventListener("touchstart", unlockAudio);
      };
      window.addEventListener("click", unlockAudio);
      window.addEventListener("touchstart", unlockAudio);
      return () => {
        window.removeEventListener("click", unlockAudio);
        window.removeEventListener("touchstart", unlockAudio);
      };
    }
  }, [isActive]);

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
          gymChime.stopSilence(); // Stopped rest carrier wave
          gymChime.play(); // Play the chime explicitly!

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("Tempo di Riposo Completato! 🔔", {
                body: "Il tuo riposo è terminato, è ora di iniziare la serie successiva!",
                silent: false,
              });
            } catch {
              // ignore notification errors
            }
          }
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
      currentReps = inheritedReps;
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
      const duration = defaultRestSeconds;
      setRestTimeLeft(duration);
      setIsRestPaused(false);
      setRestEndTime(Date.now() + duration * 1000);
      setRestingSetKey(key); // Set active resting set
      gymChime.startSilence(duration); // Start background wave and schedule background chime!
    } else {
      if (restingSetKey === key) {
        setRestingSetKey(null);
        setRestTimeLeft(0);
        setRestEndTime(null);
        gymChime.stopSilence(); // Stop background wave
      }
    }
  };

  const adjustRestTimer = (seconds: number) => {
    setRestTimeLeft((prev) => {
      const nextVal = Math.max(0, prev + seconds);
      
      if (nextVal <= 0) {
        setRestEndTime(null);
        setRestingSetKey(null);
        gymChime.stopSilence();
        return 0;
      }

      if (!isRestPaused) {
        setRestEndTime(Date.now() + nextVal * 1000);
        gymChime.startSilence(nextVal);
      }

      return nextVal;
    });

    // Save adjusted duration as the new default rest duration
    setDefaultRestSeconds((prev) => {
      const nextDefault = Math.max(15, prev + seconds);
      if (typeof window !== "undefined") {
        localStorage.setItem("default_rest_seconds", nextDefault.toString());
      }
      return nextDefault;
    });
  };

  const toggleKeepAlive = () => {
    const nextVal = !keepAlive;
    setKeepAlive(nextVal);
    if (typeof window !== "undefined") {
      localStorage.setItem("keep_alive_in_background", nextVal.toString());
      if (restTimeLeft > 0 && !isRestPaused && restEndTime) {
        if (nextVal) {
          const timeLeft = Math.max(0, Math.ceil((restEndTime - Date.now()) / 1000));
          gymChime.startSilence(timeLeft);
        } else {
          gymChime.stopSilence();
        }
      }
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
            workoutName,
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
      {/* Grab-Handle Header with Drag-to-Minimize gesture */}
      <header 
        onTouchStart={handleHeaderTouchStart}
        onTouchMove={handleHeaderTouchMove}
        onTouchEnd={handleHeaderTouchEnd}
        className="glass-header flex flex-col items-center p-3 relative cursor-grab active:cursor-grabbing border-b border-black/5 dark:border-white/5"
      >
        {/* iOS-Style Pill Handle Indicator */}
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mb-2"></div>
        
        <div className="w-full flex justify-between items-center px-1">
          <button 
            onClick={handleCancelWorkout} 
            className="text-red-500 font-semibold active:scale-95 transition-transform text-sm"
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
              className="flex items-center gap-1.5 text-primary font-extrabold text-base leading-none tracking-tight active:scale-95 transition-transform group cursor-pointer"
              title="Tocca per modificare il nome dell'allenamento / Settimana"
            >
              <span>{workoutName}</span>
              <Pencil size={12} className="text-gray-400 group-hover:text-primary transition-colors" />
            </button>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-secondary font-mono text-sm font-bold bg-black/5 dark:bg-white/5 px-2.5 py-0.5 rounded-full">{formatTime(durationSeconds)}</span>
              
              {/* App Shortcuts: Spotify & Google Sheets */}
              <div className="flex items-center gap-1.5">
                <a
                  href="spotify:"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = "spotify:";
                    setTimeout(() => {
                      window.open("https://open.spotify.com", "_blank");
                    }, 500);
                  }}
                  className="w-6.5 h-6.5 rounded-full bg-[#1DB954]/15 hover:bg-[#1DB954]/25 border border-[#1DB954]/30 flex items-center justify-center text-[#1DB954] active:scale-90 transition-all cursor-pointer shadow-sm"
                  title="Apri Spotify"
                  aria-label="Apri Spotify"
                >
                  <SpotifyLogo size={14} />
                </a>

                <a
                  href="googlesheets:"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = "googlesheets:";
                    setTimeout(() => {
                      window.open("https://docs.google.com/spreadsheets", "_blank");
                    }, 500);
                  }}
                  className="w-6.5 h-6.5 rounded-full bg-[#0F9D58]/15 hover:bg-[#0F9D58]/25 border border-[#0F9D58]/30 flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-sm"
                  title="Apri Scheda Cata 19 su Google Sheets"
                  aria-label="Apri Google Sheets"
                >
                  <GoogleSheetsLogo size={14} />
                </a>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleFinishWorkout} 
            className="bg-primary text-white text-xs font-extrabold px-4 py-2 rounded-full shadow-md shadow-primary/20 active:scale-95 transition-all duration-200"
          >
            Fine
          </button>
        </div>
      </header>

      {/* Exercises Scroll List */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 transition-all duration-300 ${activeKeypad ? "pb-[320px]" : "pb-28"}`}>
        {activeExercises.map((ex, exIdx) => {
          const foundEx = exercisesCatalog.find(c => c.id === ex.exerciseId);
          const isDuration = foundEx ? foundEx.equipment.toLowerCase().includes("durata") : false;

          return (
            <div key={ex.exerciseId} className="glass-panel rounded-2xl overflow-hidden border border-white/20 dark:border-white/5">
              <div className="p-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-white/10 dark:bg-black/10">
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedHistoryExercise({ id: ex.exerciseId, name: ex.exerciseName })}
                    className="flex items-center gap-1.5 active:scale-95 transition-transform group text-left cursor-pointer"
                    title="Tocca per vedere lo storico delle settimane precedenti"
                  >
                    <h2 className="text-[17px] font-extrabold text-primary group-hover:underline">{ex.exerciseName}</h2>
                    <span className="text-[9px] font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/20 flex items-center gap-0.5 group-hover:bg-primary/20 transition-all uppercase tracking-wider">
                      <History size={11} /> Storico
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5 items-center">
                    {isDuration ? (
                      <>
                        <span>Durata tot: <span className="font-semibold text-primary">{secondsToHHMMSS(ex.sets.reduce((sum, s) => sum + s.reps, 0)) || "00:00"}</span></span>
                        {ex.sets.some(s => s.weight > 0) && (
                          <span>Zavorra max: <span className="font-semibold text-primary">{Math.max(...ex.sets.map(s => s.weight))} kg</span></span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1">
                          Volume: <span className="font-semibold text-primary">{ex.sets.reduce((sum, s) => sum + calculateSetVolume(s.weight, s.reps, s.type, isDuration), 0)} kg</span>
                          {(() => {
                            const currentVolume = ex.sets.reduce((sum, s) => sum + calculateSetVolume(s.weight, s.reps, s.type, isDuration), 0);
                            const delta = getExerciseVolumeDelta(ex.exerciseId, currentVolume, isDuration, ex.exerciseName);
                            if (!delta) return null;
                            return (
                              <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.2 rounded font-sans uppercase leading-none ${
                                delta.isNeutral
                                  ? "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 dark:text-zinc-400"
                                  : delta.isPositive 
                                    ? "bg-green-500/10 text-green-600 border border-green-500/20 dark:text-green-400" 
                                    : "bg-red-500/10 text-red-600 border border-red-500/20 dark:text-red-400"
                              }`}>
                                {delta.isNeutral ? "●" : delta.isPositive ? "▲" : "▼"} {delta.percent}
                              </span>
                            );
                          })()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => removeExercise(exIdx)}
                  className="p-2 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 active:scale-95 transition-colors"
                  aria-label="Rimuovi esercizio"
                >
                  <Trash2 size={18} />
                </button>
              </div>
                 <div className="px-4 py-3">
                {/* Custom CSS Grid table for absolute smooth swipe gestures */}
                <div className="w-full text-sm">
                  {/* Grid Header */}
                  <div className="grid grid-cols-[40px_1fr_48px_1fr_48px] items-center text-gray-500 text-[11px] uppercase tracking-wider pb-2 px-1">
                    <span className="font-bold text-left">Serie</span>
                    <span className="font-bold text-center">{isDuration ? "+ kg" : "kg"}</span>
                    <span className="font-bold text-center">RPE</span>
                    <span className="font-bold text-center">{isDuration ? "tempo" : "reps"}</span>
                    <span className="font-bold text-center">✓</span>
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
                        repsPlaceholder = inheritedReps > 0 ? inheritedReps.toString() : "0";
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
                            className="absolute inset-0 bg-red-500 flex items-center justify-end pr-4 text-white transition-opacity duration-200"
                            style={{
                              opacity: currentOffset > 0 ? 1 : 0
                            }}
                          >
                            <div 
                              className={`transition-all duration-200 ${
                                currentOffset > 150 ? "scale-125 text-white" : "scale-100 text-white/80"
                              }`}
                            >
                              <Trash2 size={18} className={currentOffset > 150 ? "animate-bounce" : ""} />
                            </div>
                          </div>

                          {/* Foreground Swiping Row */}
                          <div 
                            className={`grid grid-cols-[40px_1fr_48px_1fr_48px] items-center py-3.5 px-1 rounded-xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 relative z-10 transition-transform ${
                              isDone ? "bg-primary/5 dark:bg-primary/10 border-primary/20" : ""
                            }`}
                            style={{
                              transform: `translateX(${-currentOffset}px)`,
                              transition: isSwipingThis ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease",
                              touchAction: "pan-y"
                            }}
                          >
                             {/* Serie Badge (Interactive button to cycle types) */}
                             <div className="text-left pl-1">
                               <button
                                 type="button"
                                 onClick={() => cycleSetType(exIdx, setIdx)}
                                 className={`rounded-lg w-7 h-7 text-[13px] font-bold flex items-center justify-center active:scale-90 transition-transform ${
                                   set.type === "W"
                                     ? "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                                     : set.type === "F"
                                       ? "bg-red-500/10 text-red-500 border border-red-500/20"
                                       : set.type === "D"
                                         ? "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                                         : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                 }`}
                                 title="Tipo di serie: Normale, Warmup (W), Cedimento (F), Dropset (D)"
                               >
                                 {set.type === "W" ? "W" : set.type === "F" ? "F" : set.type === "D" ? "D" : set.setOrder}
                               </button>
                             </div>
                             
                             {/* Weight Column: Capsule Pill Input */}
                             <div className="px-1">
                               <div className="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors rounded-full flex items-center justify-between px-3.5 py-1.5 border border-transparent focus-within:border-primary/40 w-full relative z-20">
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
                                   className="w-full bg-transparent text-center font-bold text-[17px] focus:outline-none text-primary caret-primary placeholder:text-gray-400 dark:placeholder:text-gray-600" 
                                 />
                                 <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold select-none pr-0.5 uppercase">kg</span>
                               </div>
                             </div>

                             {/* RPE Column (RPE button) */}
                             <div className="text-center">
                               <button 
                                 type="button"
                                 onClick={() => setRpePickerState({ exIdx, setIdx })}
                                 className={`h-7 min-w-[28px] px-1.5 rounded-md text-[11px] font-bold transition-all flex items-center justify-center mx-auto ${
                                   set.rpe !== undefined && set.rpe > 0
                                     ? "bg-primary/10 text-primary border border-primary/20 scale-105" 
                                     : "text-gray-400 hover:text-primary bg-black/5 dark:bg-white/5"
                                 }`}
                               >
                                 {set.rpe !== undefined && set.rpe > 0 ? set.rpe.toString().replace(".", ",") : "@"}
                               </button>
                             </div>

                             {/* Reps or Duration Column: Capsule Pill Input */}
                             <div className="px-1">
                               <div className="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors rounded-full flex items-center justify-between px-3 py-1.5 border border-transparent focus-within:border-primary/40 w-full relative z-20">
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
                                     className="w-full bg-transparent text-center font-bold text-[17px] font-mono focus:outline-none text-primary caret-primary placeholder:text-gray-400 dark:placeholder:text-gray-600 animate-none" 
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
                                     className="w-full bg-transparent text-center font-bold text-[17px] focus:outline-none text-primary caret-primary placeholder:text-gray-400 dark:placeholder:text-gray-600" 
                                   />
                                 )}
                                 <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold select-none pr-0.5 uppercase">
                                   {isDuration ? "sec" : "reps"}
                                 </span>
                               </div>
                             </div>

                            {/* Tick Checkbox complete button */}
                            <div className="text-center">
                              <button 
                                onClick={() => toggleSetComplete(exIdx, setIdx)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all duration-200 ${
                                  isDone 
                                    ? "bg-primary text-white shadow-sm shadow-primary/40 active:scale-90" 
                                    : "bg-black/5 dark:bg-white/10 text-gray-400 hover:text-primary active:scale-90"
                                }`}
                              >
                                <Check size={16} className="stroke-[3.5px]" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );

                      if (restingSetKey === setKey && restTimeLeft > 0) {
                        const restBar = (
                          <div key={`${setIdx}-rest`} className="animate-in slide-in-from-top-1 duration-300 py-1">
                            <div className="relative w-full h-8 bg-black/5 dark:bg-white/5 rounded-xl overflow-hidden shadow-inner border border-black/5 dark:border-white/5 flex items-center justify-between p-0.5">
                              {/* Glowing Gradient Collapsing Rest Progress Bar */}
                              <div 
                                className="absolute top-0.5 bottom-0.5 left-0.5 bg-gradient-to-r from-primary to-blue-500 rounded-lg shadow-[0_0_12px_rgba(0,87,255,0.35)] transition-all duration-1000 ease-linear z-0"
                                style={{ width: `calc(${(restTimeLeft / defaultRestSeconds) * 100}% - 4px)` }}
                              />
                              
                              {/* Left Adjuster */}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  adjustRestTimer(-15);
                                }}
                                className="relative z-10 w-7 h-7 rounded-lg bg-white/20 dark:bg-black/20 hover:bg-white/30 text-zinc-900 dark:text-white flex items-center justify-center text-[10px] font-black active:scale-90 transition-transform ml-0.5 border border-white/10"
                                title="Sottrai 15s"
                              >
                                -15s
                              </button>

                              {/* Counter in MM:SS (Super readable, high contrast text) */}
                              <div className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-zinc-900 dark:text-white font-sans tracking-wider z-10 pointer-events-none">
                                {Math.floor(restTimeLeft / 60).toString().padStart(2, "0")}:{(restTimeLeft % 60).toString().padStart(2, "0")}
                              </div>

                              {/* Right Adjuster */}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  adjustRestTimer(15);
                                }}
                                className="relative z-10 w-7 h-7 rounded-lg bg-white/20 dark:bg-black/20 hover:bg-white/30 text-zinc-900 dark:text-white flex items-center justify-center text-[10px] font-black active:scale-90 transition-transform mr-0.5 border border-white/10"
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
              </div>
              <button 
                onClick={() => addSet(exIdx)}
                className="w-full mt-3 py-2 text-primary hover:bg-primary/5 rounded-xl border border-dashed border-primary/20 font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all"
              >
                <Plus size={14} /> Serie
              </button>

              {/* Sensazioni / Feedback Esercizio */}
              <div className="mt-3.5 pt-3 border-t border-black/5 dark:border-white/5 flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-1">
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
                  className="glass-input w-full px-4 py-3 rounded-xl text-[16px] placeholder:text-[14px] outline-none font-medium resize-none text-zinc-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-600 bg-black/5 dark:bg-white/5 focus:bg-white dark:focus:bg-zinc-950 border border-transparent focus:border-primary/30 transition-all duration-200"
                />
              </div>
            </div>
          );
        })}

        {/* Global Add Exercise Button at bottom */}
        <button 
          onClick={() => setIsAddExerciseOpen(true)}
          className="w-full py-4 glass-panel bg-white/20 hover:bg-white/30 text-primary font-bold rounded-2xl flex items-center justify-center gap-2 border-dashed border-primary/30 active:scale-95 transition-all"
        >
          <Plus size={20} /> Aggiungi Esercizio
        </button>
      </div>

      {/* Rest Timer Panel */}
      {restTimeLeft > 0 && (
        <div className="glass-nav fixed bottom-0 left-0 right-0 p-4 flex items-center justify-between pb-safe z-[105] shadow-[0_-8px_30px_rgb(0,0,0,0.15)] border-t border-white/20">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (isRestPaused) {
                  setRestEndTime(Date.now() + restTimeLeft * 1000);
                  setIsRestPaused(false);
                  gymChime.startSilence(restTimeLeft); // Keep alive and reschedule chime!
                } else {
                  setRestEndTime(null);
                  setIsRestPaused(true);
                  gymChime.stopSilence(); // Can go to sleep when paused
                }
              }}
              className="w-10 h-10 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary active:scale-90 transition-transform"
            >
              {isRestPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
            </button>
            <div className="flex flex-col">
              <button 
                onClick={toggleKeepAlive}
                className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-transform"
                title="Suoneria attiva: Spotify continua a suonare senza interruzioni"
              >
                <span>Tempo di Riposo</span>
                {keepAlive ? (
                  <span className="text-primary text-[8px] bg-primary/10 px-1 rounded-full border border-primary/20 leading-none py-0.5 font-sans">🔔 SPOTIFY OK</span>
                ) : (
                  <span className="text-gray-400 text-[8px] bg-gray-500/10 px-1 rounded-full border border-gray-500/20 leading-none py-0.5 font-sans">SILENZIOSO 🔇</span>
                )}
              </button>
              <span className="font-mono font-bold text-xl leading-none text-secondary mt-0.5">
                {Math.floor(restTimeLeft / 60).toString().padStart(2, "0")}:
                {(restTimeLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* Quick glassmorphic time adjusters */}
          <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 rounded-full p-1 border border-black/5 dark:border-white/5">
            <button 
              onClick={() => adjustRestTimer(-15)}
              className="w-9 h-9 rounded-full bg-white/40 dark:bg-black/30 hover:bg-white/60 dark:hover:bg-black/50 text-zinc-800 dark:text-white flex items-center justify-center text-xs font-black shadow-sm active:scale-90 transition-transform"
              title="Sottrai 15 secondi"
            >
              -15s
            </button>
            <button 
              onClick={() => adjustRestTimer(15)}
              className="w-9 h-9 rounded-full bg-white/40 dark:bg-black/30 hover:bg-white/60 dark:hover:bg-black/50 text-zinc-800 dark:text-white flex items-center justify-center text-xs font-black shadow-sm active:scale-90 transition-transform"
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
              gymChime.stopSilence(); // Stopped rest
            }}
            className="flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-400 bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/5 px-4 py-2 rounded-full active:scale-95 transition-transform"
          >
            Salta <FastForward size={14} />
          </button>
        </div>
      )}

      {/* Add Exercise Modal (Catalog Browser) */}
      {isAddExerciseOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-lg rounded-t-3xl p-6 h-[80vh] flex flex-col gap-4 ios-modal-animate border-x-0 border-b-0">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Aggiungi Esercizio</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="text-xs font-bold text-primary flex items-center gap-0.5 active:scale-95 transition-transform bg-primary/10 px-3 py-1.5 rounded-full"
                >
                  <Plus size={14} /> Nuovo
                </button>
                <button 
                  onClick={() => setIsAddExerciseOpen(false)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Cerca nel catalogo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="glass-input w-full px-4 py-3 rounded-xl text-sm outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredCatalog.map((ex) => (
                <div 
                  key={ex.id}
                  onClick={() => selectExercise(ex)}
                  className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-white/5 hover:bg-white/10 dark:hover:bg-white/5 transition-all cursor-pointer flex justify-between items-center active:scale-[0.98]"
                >
                  <div>
                    <h4 className="font-semibold text-sm">{ex.name}</h4>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">{ex.muscleGroup} • {ex.equipment}</span>
                  </div>
                  <Plus size={18} className="text-primary" />
                </div>
              ))}
              {filteredCatalog.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm font-medium">
                  Nessun esercizio trovato per &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RPE Picker Sheet Overlay */}
      {rpePickerState && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-lg rounded-t-3xl p-6 flex flex-col gap-4 ios-modal-animate border-x-0 border-b-0 pb-safe bg-white">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-foreground">Scala Sforzo RPE</h3>
                <p className="text-xs text-gray-500 mt-0.5">Seleziona lo sforzo percepito (da 5 a 10 con mezzi punti)</p>
              </div>
              <button 
                onClick={() => setRpePickerState(null)}
                className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 active:scale-95 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2.5 py-2">
              {[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1].map((val) => {
                const currentSet = activeExercises[rpePickerState.exIdx]?.sets[rpePickerState.setIdx];
                const isSelected = currentSet?.rpe === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => selectRpe(val)}
                    className={`py-3 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
                      isSelected
                        ? "bg-primary text-white border-primary shadow-md shadow-primary/10"
                        : "bg-black/5 border-transparent text-foreground hover:bg-black/10"
                    }`}
                  >
                    {val.toString().replace(".", ",")}
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
        
        return (
          <div className="fixed bottom-0 left-0 right-0 z-[120] glass-panel bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-t border-black/5 dark:border-white/10 shadow-[0_-12px_40px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom duration-300 pb-safe">
            {/* Keyboard Header */}
            <div className="flex justify-between items-center px-4 py-2 border-b border-black/5 dark:border-white/5">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-gray-400 dark:text-gray-500">
                  Stai compilando
                </span>
                <span className="text-xs font-bold text-primary">
                  {currentEx.exerciseName} • Serie {setIdx + 1} ({field === "weight" ? "KG" : "Reps"})
                </span>
              </div>
              <button 
                onClick={() => setActiveKeypad(null)}
                className="text-xs font-extrabold text-primary hover:text-primary/80 bg-primary/10 px-3.5 py-1.5 rounded-full active:scale-95 transition-transform"
              >
                Fine
              </button>
            </div>

            {/* Keyboard Keys Layout */}
            <div className="p-4 grid grid-cols-5 gap-3 h-[240px]">
              {/* Left 80%: Numeric keys grid */}
              <div className="col-span-4 grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num)}
                    className="bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 active:scale-90 transition-transform text-foreground font-bold text-lg rounded-xl flex items-center justify-center border border-black/5 dark:border-white/5 select-none"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleKeypadPress(",")}
                  className="bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 active:scale-90 transition-transform text-foreground font-bold text-lg rounded-xl flex items-center justify-center border border-black/5 dark:border-white/5 select-none"
                >
                  ,
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress("0")}
                  className="bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 active:scale-90 transition-transform text-foreground font-bold text-lg rounded-xl flex items-center justify-center border border-black/5 dark:border-white/5 select-none"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 active:scale-90 transition-transform text-foreground font-bold text-lg rounded-xl flex items-center justify-center border border-black/5 dark:border-white/5 select-none"
                >
                  ⌫
                </button>
              </div>

              {/* Right 20%: Stepper keys column */}
              <div className="col-span-1 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleKeypadAdjust("up")}
                  className="flex-1 bg-green-500/10 hover:bg-green-500/20 active:scale-90 transition-transform text-green-500 font-extrabold text-2xl flex items-center justify-center rounded-xl border border-green-500/20 select-none"
                  title="Incrementa"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadAdjust("down")}
                  className="flex-1 bg-red-500/10 hover:bg-red-500/20 active:scale-90 transition-transform text-red-500 font-extrabold text-2xl flex items-center justify-center rounded-xl border border-red-500/20 select-none"
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
                  Stiamo aggiornando la tua **&ldquo;Scheda Cata 19&rdquo;** su Google Drive con i tuoi KG e feedback della settimana...
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
              Personalizza il nome o la settimana dell&apos;allenamento (es. &ldquo;Petto Dorso W2&rdquo;):
            </p>

            <input
              type="text"
              value={editedWorkoutName}
              onChange={(e) => setEditedWorkoutName(e.target.value)}
              placeholder="Es. Petto Dorso W2..."
              className="glass-input w-full px-4 py-3 rounded-xl text-base outline-none font-semibold bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10"
              autoFocus
            />

            {/* Quick Week Chips */}
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Seleziona Settimana:</span>
              <div className="flex flex-wrap gap-1.5">
                {["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"].map((week) => {
                  const updateWeekName = () => {
                    let base = editedWorkoutName.trim();
                    if (/\bW\d+\b/i.test(base)) {
                      base = base.replace(/\bW\d+\b/i, week);
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
    </div>
  </>
);
}
