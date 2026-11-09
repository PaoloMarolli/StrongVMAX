"use client";

import React, { useState, useEffect, useRef } from "react";
import { storage, WorkoutSession, Exercise, WorkoutExercise, WorkoutSet, calculateSetVolume, computeSupersetMap } from "@/utils/storage";
import { useWorkout } from "@/context/WorkoutContext";
import { formatDistanceToNow, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar, Clock, Dumbbell, Award, Flame, Trash2, X, Plus, User, LogOut, CheckCircle2, ChevronLeft, ChevronRight, Download, Upload, Copy, Link2, AlertCircle } from "lucide-react";
import { useSession, signOut, signIn } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";
import ThemeQuickToggle from "@/components/ThemeQuickToggle";
import ModalPortal from "@/components/ModalPortal";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(dateStr: string) {
  try {
    const date = parseISO(dateStr);
    return formatDistanceToNow(date, { addSuffix: true, locale: it });
  } catch {
    return dateStr;
  }
}

function secondsToHHMMSS(seconds: number): string {
  if (!seconds) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function HistoryView() {
  const { data: session } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [activeWeekdays, setActiveWeekdays] = useState<boolean[]>([false, false, false, false, false, false, false]); // Lun (0) a Dom (6)
  const [catalog, setCatalog] = useState<Exercise[]>([]);

  // Backup & Restore states
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [backupCopyFeedback, setBackupCopyFeedback] = useState(false);

  const handleExportBackup = () => {
    const dataStr = storage.exportBackup();
    // Copy to clipboard
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(dataStr).then(() => {
        setBackupCopyFeedback(true);
        setTimeout(() => setBackupCopyFeedback(false), 3000);
      }).catch(() => {});
    }
    // Also trigger file download
    try {
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `StrongVMAX-Backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleImportBackup = () => {
    if (!importJsonText.trim()) return;
    const success = storage.importBackup(importJsonText.trim());
    if (success) {
      alert("Dati e storico importati con successo! Ricarico l'app...");
      setIsBackupModalOpen(false);
      window.location.reload();
    } else {
      alert("Errore nell'importazione dei dati. Verifica che il formato JSON sia valido.");
    }
  };

  // Past Workout Editor States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [sessionExercises, setSessionExercises] = useState<WorkoutExercise[]>([]);
  const [timeInputs, setTimeInputs] = useState<Record<string, string>>({});

  // Aggiungi Esercizio inside Past Workout Editor
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMuscleGroup, setNewMuscleGroup] = useState("Petto");
  const [newEquipment, setNewEquipment] = useState("Bilanciere");
  const [newBarbellPreset, setNewBarbellPreset] = useState("Olimpico (20 kg)");
  const [newCustomBarbellText, setNewCustomBarbellText] = useState("");

  const filteredCatalog = catalog.filter((ex) =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectSessionExercise = (ex: Exercise) => {
    setSessionExercises((prev) => {
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
    
    // Automatically select the newly created exercise in the active selection
    setSessionExercises((prev) => {
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

  // Monthly Calendar States
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const swipeStartX = useRef<number>(0);
  const swipeEndX = useRef<number>(0);

  const getCalendarDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    let startDayIdx = firstDay.getDay();
    startDayIdx = startDayIdx === 0 ? 6 : startDayIdx - 1;
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    
    const days: { day: number; monthOffset: number; dateObject: Date }[] = [];
    
    for (let i = startDayIdx - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i;
      days.push({ day: dayNum, monthOffset: -1, dateObject: new Date(year, month - 1, dayNum) });
    }
    
    for (let i = 1; i <= totalDays; i++) {
      days.push({ day: i, monthOffset: 0, dateObject: new Date(year, month, i) });
    }
    
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, monthOffset: 1, dateObject: new Date(year, month + 1, i) });
    }
    
    return days;
  };

  const getMonthlyWorkoutCount = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return history.filter(session => {
      const sessDate = new Date(session.date);
      return sessDate.getFullYear() === year && sessDate.getMonth() === month;
    }).length;
  };

  const getWorkoutsForDate = (dateObject: Date) => {
    const year = dateObject.getFullYear();
    const month = dateObject.getMonth();
    const dateNum = dateObject.getDate();
    return history.filter(session => {
      const sessDate = new Date(session.date);
      return sessDate.getFullYear() === year && sessDate.getMonth() === month && sessDate.getDate() === dateNum;
    });
  };

  const getMonthNameItalian = (date: Date) => {
    const months = [
      "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
      "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeEndX.current = 0; // Reset swipeEndX on new touch start
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    swipeEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (swipeEndX.current === 0) return; // Ignore simple taps
    const diffX = swipeStartX.current - swipeEndX.current;
    const threshold = 50;
    if (Math.abs(diffX) > threshold) {
      if (diffX > 0) {
        handleNextMonth();
      } else {
        handlePrevMonth();
      }
    }
    swipeStartX.current = 0;
    swipeEndX.current = 0;
  };

  const handlePrevMonth = () => {
    setCalendarDate((prev) => {
      return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
    });
  };

  const handleNextMonth = () => {
    setCalendarDate((prev) => {
      return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
    });
  };


  const hhmmssToSeconds = (str: string): number => {
    if (!str) return 0;
    const clean = str.replace(/[^0-9:]/g, "");
    const parts = clean.split(":");
    if (parts.length === 3) {
      const hrs = parseInt(parts[0], 10) || 0;
      const mins = parseInt(parts[1], 10) || 0;
      const secs = parseInt(parts[2], 10) || 0;
      return hrs * 3600 + mins * 60 + secs;
    } else if (parts.length === 2) {
      const mins = parseInt(parts[0], 10) || 0;
      const secs = parseInt(parts[1], 10) || 0;
      return mins * 60 + secs;
    } else if (parts.length === 1) {
      return parseInt(parts[0], 10) || 0;
    }
    return 0;
  };

  const handleEditSession = (session: WorkoutSession) => {
    setEditingSession(session);
    setSessionName(session.name);
    setSessionExercises(JSON.parse(JSON.stringify(session.exercises)));
    setTimeInputs({});
    setIsEditorOpen(true);
  };

  const updateSessionSet = (exIdx: number, setIdx: number, field: "weight" | "reps", val: string) => {
    const num = parseFloat(val) || 0;
    setSessionExercises((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[exIdx].sets[setIdx][field] = num;
      return copy;
    });
  };

  const cycleSessionSetType = (exIdx: number, setIdx: number) => {
    setSessionExercises((prev) => {
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
  };

  const handleTimeInputChange = (exIdx: number, setIdx: number, val: string) => {
    const key = `${exIdx}_${setIdx}`;
    setTimeInputs((prev) => ({
      ...prev,
      [key]: val,
    }));
    const seconds = hhmmssToSeconds(val);
    setSessionExercises((prev) => {
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
    setSessionExercises((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[exIdx].sets[setIdx].reps = seconds;
      return copy;
    });
  };

  const addSessionSet = (exIdx: number) => {
    setSessionExercises((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const sets = copy[exIdx].sets;
      const lastSet = sets[sets.length - 1];
      sets.push({
        weight: lastSet ? lastSet.weight : 0,
        reps: lastSet ? lastSet.reps : 0,
        setOrder: sets.length + 1,
      });
      return copy;
    });
  };

  const removeSessionSet = (exIdx: number, setIdx: number) => {
    setSessionExercises((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[exIdx].sets.splice(setIdx, 1);
      copy[exIdx].sets.forEach((s: WorkoutSet, idx: number) => {
        s.setOrder = idx + 1;
      });
      return copy;
    });

    setTimeInputs(prev => {
      const next = { ...prev };
      delete next[`${exIdx}_${setIdx}`];
      for (let i = setIdx + 1; i <= 50; i++) {
        const oldKey = `${exIdx}_${i}`;
        const newKey = `${exIdx}_${i - 1}`;
        if (next[oldKey] !== undefined) {
          next[newKey] = next[oldKey];
          delete next[oldKey];
        }
      }
      return next;
    });
  };

  const handleDeleteSession = (id: string) => {
    if (confirm("Sei sicuro di voler eliminare definitivamente questo allenamento dallo storico?")) {
      storage.deleteWorkout(id);
      
      const updatedList = storage.getHistory();
      setHistory(updatedList);
      
      // Ricalcola streaks ed allenamenti settimanali
      const now = new Date();
      const currentDay = now.getDay();
      const monday = new Date(now);
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      monday.setDate(now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      
      const weeklySessions = updatedList.filter((session) => {
        const sessDate = new Date(session.date);
        return sessDate >= monday && sessDate <= sunday;
      });
      setWeeklyCount(weeklySessions.length);
      
      const activeDays = [false, false, false, false, false, false, false];
      weeklySessions.forEach((session) => {
        const sessDate = new Date(session.date);
        const dayIdx = sessDate.getDay();
        const index = dayIdx === 0 ? 6 : dayIdx - 1;
        activeDays[index] = true;
      });
      setActiveWeekdays(activeDays);
      
      setIsEditorOpen(false);
      setEditingSession(null);
    }
  };

  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession || !sessionName.trim()) return;

    const cleanExercises = sessionExercises.filter(ex => ex.sets.length > 0).map(ex => ({
      ...ex,
      sets: ex.sets.map(set => ({
        ...set,
        rpe: set.rpe !== undefined && set.rpe !== null && set.rpe.toString() !== "" ? parseFloat(set.rpe.toString().replace(",", ".")) : undefined
      }))
    }));

    let vol = 0;
    cleanExercises.forEach((ex) => {
      const foundEx = catalog.find(e => e.id === ex.exerciseId);
      const isDuration = foundEx ? foundEx.equipment.toLowerCase().includes("durata") : false;
      ex.sets.forEach((set) => {
        vol += calculateSetVolume(set.weight, set.reps, set.type, isDuration);
      });
    });

    const updatedSession: WorkoutSession = {
      ...editingSession,
      name: sessionName,
      exercises: cleanExercises,
      totalVolume: vol,
    };

    storage.updateWorkout(updatedSession);
    setHistory(storage.getHistory());
    setIsEditorOpen(false);
    setEditingSession(null);
  };

  // Google Sheets Syncing States for Past Workouts
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"syncing" | "success" | "error" | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState("");

  const handleSyncPastWorkout = async (sessionToSync: WorkoutSession) => {
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
          workoutName: sessionToSync.name,
          exercises: sessionToSync.exercises,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSyncStatus("success");
        setTimeout(() => {
          setIsSyncing(false);
          setSyncStatus(null);
        }, 1500);
      } else {
        setSyncStatus("error");
        const errMsg = data.error || "Errore di sincronizzazione.";
        if (response.status === 401) {
          setSyncErrorMsg("Sessione Google scaduta. Re-indirizzamento automatico per l'accesso sicuro...");
          setTimeout(() => {
            signIn("google", { callbackUrl: window.location.href });
          }, 1800);
        } else {
          setSyncErrorMsg(errMsg);
        }
      }
    } catch {
      setSyncStatus("error");
      setSyncErrorMsg("Errore di connessione di rete.");
    }
  };

  useEffect(() => {
    const list = storage.getHistory();
    setHistory(list);
    setCatalog(storage.getExercises());

    // Calcolo degli allenamenti della settimana corrente (Lunedì - Domenica)
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Domenica, 1 = Lunedì, ecc.
    
    // Trova il Lunedì di questa settimana
    const monday = new Date(now);
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay; // correzione se oggi è Domenica
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    // Trova la Domenica di questa settimana
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weeklySessions = list.filter((session) => {
      const sessDate = new Date(session.date);
      return sessDate >= monday && sessDate <= sunday;
    });

    setWeeklyCount(weeklySessions.length);

    // Mappa quali giorni hanno un allenamento (Lunedì = 0, ..., Domenica = 6)
    const activeDays = [false, false, false, false, false, false, false];
    weeklySessions.forEach((session) => {
      const sessDate = new Date(session.date);
      const dayIdx = sessDate.getDay(); // 0 = Dom, 1 = Lun, ...
      const index = dayIdx === 0 ? 6 : dayIdx - 1; // mappa in modo che Lun sia 0 e Dom sia 6
      activeDays[index] = true;
    });
    setActiveWeekdays(activeDays);
  }, []);

  const weekdaysLabels = ["L", "M", "M", "G", "V", "S", "D"];

  const { isBottomBarVisible, setBottomBarVisible, isActive, isMinimized } = useWorkout();

  useEffect(() => {
    if (isEditorOpen || isCalendarOpen || isProfileOpen) {
      setBottomBarVisible(false);
    } else {
      setBottomBarVisible(true);
    }
  }, [isEditorOpen, isCalendarOpen, isProfileOpen, setBottomBarVisible]);

  const isModalActive = !isBottomBarVisible || isEditorOpen || isCalendarOpen || isProfileOpen || (isActive && !isMinimized);

  return (
    <>
      <div className={`flex flex-col h-full w-full relative z-0 ${isModalActive ? "apple-page-scaled" : ""}`}>
        <header className="glass-header flex justify-between items-center p-4 sticky top-0 z-10">
          <h1 className="text-3xl font-black font-sans tracking-tight">Storico</h1>
          
          <div className="flex items-center gap-2">
            <ThemeQuickToggle />
            <button
              onClick={() => setIsProfileOpen(true)}
              className="w-9 h-9 rounded-full overflow-hidden border border-white/30 dark:border-white/10 ring-2 ring-primary/20 active:scale-95 transition-all flex items-center justify-center bg-black/5 dark:bg-white/5"
            >
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || "Profilo"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-primary flex items-center justify-center">
                  {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : <User size={16} />}
                </span>
              )}
            </button>
          </div>
        </header>
      
      <div className="p-4 flex-1 overflow-y-auto pb-20 space-y-5">
        
        {/* Weekly Activity Gamified Panel */}
        <div 
          onClick={() => {
            setCalendarDate(new Date());
            setIsCalendarOpen(true);
          }}
          className="glass-panel p-5 rounded-2xl border border-white/20 dark:border-white/5 shadow-md flex flex-col gap-4 bg-gradient-to-br from-white/10 to-transparent dark:from-white/5 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all hover:bg-black/5 dark:hover:bg-white/5 select-none"
        >
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white shadow-md shadow-primary/20 animate-pulse">
                <Flame size={20} fill="currentColor" />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider leading-none">Questa settimana</div>
                <div className="text-base font-bold text-foreground mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-primary font-mono">{weeklyCount}</span>
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">allenamenti</span>
                </div>
              </div>
            </div>
            
            <span className="text-[10px] text-primary font-bold uppercase tracking-wider bg-primary/10 dark:bg-primary/25 border border-primary/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
              <Calendar size={11} /> Vedi Mese
            </span>
          </div>

          {/* 7 Days Grid */}
          <div className="grid grid-cols-7 gap-2 mt-1">
            {weekdaysLabels.map((label, index) => {
              const isActive = activeWeekdays[index];
              return (
                <div key={index} className="flex flex-col items-center gap-1.5">
                  <div 
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                      isActive 
                        ? "bg-gradient-to-tr from-primary to-cyan-400 text-white shadow-md shadow-primary/30 border border-white/20 scale-105" 
                        : "glass-panel bg-black/5 dark:bg-white/5 text-gray-400 border border-transparent"
                    }`}
                  >
                    {label}
                  </div>
                  {isActive && <div className="w-1 h-1 rounded-full bg-cyan-400 animate-ping"></div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Workout History List */}
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center h-[35vh] gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Award size={32} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Nessun allenamento</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mt-1">
                Completa il tuo primo allenamento nella scheda <span className="font-bold text-primary">Routine</span> per vederlo apparire qui!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">Tutte le Sessioni</h3>
            {history.map((session) => (
              <div 
                key={session.id} 
                onClick={() => handleEditSession(session)}
                className="glass-panel p-5 rounded-2xl border border-white/20 dark:border-white/5 hover:bg-white/10 dark:hover:bg-white/5 transition-all active:scale-[0.99] cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h2 className="text-[19px] font-extrabold text-primary leading-tight">{session.name}</h2>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1 mt-1">
                      <Calendar size={12} /> {formatDate(session.date)}
                    </span>
                  </div>
                  <span className="text-[10px] bg-secondary/15 text-secondary border border-secondary/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    Completato
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-3 border-t border-black/5 dark:border-white/5 pt-3 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-[13px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Clock size={11} /> Durata
                    </span>
                    <span className="text-[15px] font-black text-foreground mt-1">{formatDuration(session.durationSeconds)}</span>
                  </div>
                  
                  <div className="flex flex-col items-center border-x border-black/5 dark:border-white/5">
                    <span className="text-[13px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Dumbbell size={11} /> Volume
                    </span>
                    <span className="text-[15px] font-black text-foreground mt-1">{session.totalVolume} kg</span>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <span className="text-[13px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Esercizi</span>
                    <span className="text-[15px] font-black text-foreground mt-1">{session.exercises.length}</span>
                  </div>
                </div>

                {/* Exercises list summary */}
                <div className="mt-3 bg-black/5 dark:bg-black/20 rounded-xl p-3 text-[13px] text-gray-600 dark:text-gray-300">
                  <ul className="space-y-0">
                    {(() => {
                      const sessionSupersetMap = computeSupersetMap(session.exercises);
                      return session.exercises.map((ex, idx) => {
                        const foundEx = catalog.find(c => c.id === ex.exerciseId);
                        const isDuration = foundEx ? foundEx.equipment.toLowerCase().includes("durata") : false;
                        const ssMeta = sessionSupersetMap[idx];

                        // Find the best set (highest weight * reps, or highest duration reps)
                        let bestSet = ex.sets[0];
                        if (ex.sets.length > 1) {
                          bestSet = ex.sets.reduce((best, current) => {
                            if (isDuration) {
                              if (current.reps !== best.reps) {
                                return current.reps > best.reps ? current : best;
                              }
                              return current.weight > best.weight ? current : best;
                            } else {
                              const currentScore = current.weight * current.reps;
                              const bestScore = best.weight * best.reps;
                              if (currentScore !== bestScore) {
                                return currentScore > bestScore ? current : best;
                              }
                              if (current.weight !== best.weight) {
                                return current.weight > best.weight ? current : best;
                              }
                              return current.reps > best.reps ? current : best;
                            }
                          }, ex.sets[0]);
                        }

                        // Adjust font size dynamically based on length of exerciseName
                        const nameLength = ex.exerciseName.length;
                        let fontSizeClass = "text-[14px]";
                        if (nameLength > 30) fontSizeClass = "text-[10.5px]";
                        else if (nameLength > 20) fontSizeClass = "text-[12px]";
                        else if (nameLength < 12) fontSizeClass = "text-[14.5px]";

                        return (
                          <li
                            key={idx}
                            className={`flex flex-col py-1.5 first:pt-0 last:pb-0 border-b border-black/5 dark:border-white/5 last:border-b-0 gap-0.5 ${
                              ssMeta ? `${ssMeta.theme.accentBorder} pl-2.5` : ""
                            }`}
                          >
                            {/* Row 1: Exercise full name (with responsive font size, fully displayed) */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {ssMeta && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 border ${ssMeta.theme.badgeBg} ${ssMeta.theme.badgeText} ${ssMeta.theme.badgeBorder}`}
                                >
                                  <Link2 size={9} className="stroke-[2.5px]" />
                                  {ssMeta.label}
                                </span>
                              )}
                              <span className={`font-extrabold text-zinc-900 dark:text-white leading-tight break-words ${fontSizeClass}`}>
                                {ex.exerciseName}
                              </span>
                            </div>
                          {/* Row 2: Set count & best set details */}
                          <span className="text-gray-500 dark:text-gray-400 font-bold text-[11px] font-sans">
                            {isDuration ? (
                              <>
                                {ex.sets.length} serie • Migliore: {secondsToHHMMSS(bestSet?.reps || 0)}{bestSet?.weight > 0 ? ` (+ ${bestSet.weight} kg)` : ""}
                              </>
                            ) : (
                              <>
                                {ex.sets.length} serie • Migliore: {bestSet?.weight || 0} kg x {bestSet?.reps || 0}
                              </>
                            )}
                          </span>
                          {/* Row 3: Compact inline set pills */}
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {ex.sets.map((set, sIdx) => {
                              const typeChar = set.type || "N";
                              let typeBg = "bg-black/5 dark:bg-white/5 text-zinc-600 dark:text-gray-400 border border-black/5 dark:border-white/5";
                              if (typeChar === "W") typeBg = "bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20";
                              else if (typeChar === "F") typeBg = "bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20";
                              else if (typeChar === "D") typeBg = "bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20";
                              
                              return (
                                <span 
                                  key={sIdx} 
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-sans font-extrabold flex items-center gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.02)] ${typeBg}`}
                                >
                                  <span className="opacity-60">{typeChar}</span>
                                  <span>{isDuration ? secondsToHHMMSS(set.reps) : `${set.weight}kg x ${set.reps}`}</span>
                                  {set.rpe !== undefined && set.rpe !== null && set.rpe > 0 && (
                                    <span className="bg-primary/10 text-primary dark:text-blue-400 dark:bg-blue-950/40 px-1 rounded text-[8.5px] font-black leading-none py-0.5 border border-primary/10 dark:border-blue-500/10">
                                      @{set.rpe}
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                          {/* Row 4: Exercise sensations / feedback */}
                          {ex.feedback && (
                            <span className="text-gray-400 dark:text-zinc-500 text-[9px] font-bold leading-normal mt-1 block pl-0.5">
                              Nota: <span className="font-semibold italic text-zinc-700 dark:text-zinc-400">{ex.feedback}</span>
                            </span>
                          )}
                        </li>
                        );
                      });
                    })()}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      {/* 100% Fullscreen Native Modal Sheet for Editing completed workouts */}
      <ModalPortal>
      {isEditorOpen && editingSession && (
        <div className="fixed inset-0 z-[120] bg-[#f5f6fa] flex flex-col p-5 ios-modal-animate pb-safe overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b border-black/5 mb-4">
            <h2 className="text-xl font-bold font-sans">Modifica Allenamento</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDeleteSession(editingSession.id)}
                className="p-2 rounded-full text-red-500 hover:bg-red-500/10 active:scale-90 transition-all animate-in fade-in"
                title="Elimina Allenamento dallo Storico"
              >
                <Trash2 size={18} />
              </button>
              <button 
                onClick={() => { setIsEditorOpen(false); setEditingSession(null); }}
                className="p-2 rounded-full bg-black/5 hover:bg-black/10 active:scale-95 transition-all"
                aria-label="Chiudi"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveSession} className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 pb-4">
              {/* Session Name input */}
              <div className="glass-panel p-4 rounded-2xl flex flex-col gap-1.5 border border-black/5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome Allenamento</label>
                <input
                  type="text"
                  placeholder="Es. Spinta, Petto e Tricipiti"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-base outline-none font-medium"
                  required
                />
              </div>

              {/* Session Exercises and Sets list */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Esercizi Eseguiti</label>
                {sessionExercises.map((ex, exIdx) => {
                  const foundEx = catalog.find(c => c.id === ex.exerciseId);
                  const isDuration = foundEx ? foundEx.equipment.toLowerCase().includes("durata") : false;

                  return (
                    <div key={ex.exerciseId} className="glass-panel p-4 rounded-2xl border border-black/5 flex flex-col gap-3">
                      <div className="flex justify-between items-center pb-2 border-b border-black/5">
                        <h4 className="font-bold text-sm text-primary">{ex.exerciseName}</h4>
                        <button
                          type="button"
                          onClick={() => {
                            setSessionExercises((prev) => prev.filter((_, idx) => idx !== exIdx));
                          }}
                          className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg active:scale-95 transition-all"
                          title="Elimina Esercizio"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <table className="w-full text-sm text-center">
                        <thead>
                          <tr className="text-gray-500 text-[10px] uppercase tracking-wider">
                            <th className="font-bold pb-1 text-left w-10">Serie</th>
                            <th className="font-bold pb-1 text-right pr-2">{isDuration ? "+ kg" : "kg"}</th>
                            <th className="font-bold pb-1 text-right pr-2">{isDuration ? "tempo" : "reps"}</th>
                            <th className="font-bold pb-1 text-center w-12">RPE</th>
                            <th className="font-bold pb-1 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {ex.sets.map((set, setIdx) => {
                            return (
                              <tr key={setIdx} className="border-t border-black/5">
                                <td className="py-2 text-left">
                                  <button
                                    type="button"
                                    onClick={() => cycleSessionSetType(exIdx, setIdx)}
                                    className={`w-6 h-6 rounded-full font-sans font-extrabold text-[10px] flex items-center justify-center transition-all duration-200 active:scale-75 ${
                                      set.type === "W"
                                        ? "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400 border border-yellow-500/20"
                                        : set.type === "F"
                                          ? "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-500/20"
                                          : set.type === "D"
                                            ? "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/20"
                                            : "bg-black/5 text-gray-400 dark:bg-white/10 dark:text-gray-400"
                                    }`}
                                    title="Cambia tipo (N -> W -> F -> D)"
                                  >
                                    {set.type === "W" ? "W" : set.type === "F" ? "F" : set.type === "D" ? "D" : set.setOrder}
                                  </button>
                                </td>
                                <td className="py-2 text-right pr-2">
                                  <input 
                                    type="number" 
                                    inputMode="decimal"
                                    value={set.weight === 0 ? "" : set.weight}
                                    placeholder={isDuration ? "+ 0" : "0"}
                                    onChange={(e) => updateSessionSet(exIdx, setIdx, "weight", e.target.value)}
                                    className="w-16 py-1 pr-2 text-right bg-black/5 rounded-lg border border-transparent focus:border-primary/40 focus:outline-none font-bold text-xs" 
                                  />
                                </td>
                                <td className="py-2 text-right pr-2">
                                  {isDuration ? (
                                    <input 
                                      type="text" 
                                      value={timeInputs[`${exIdx}_${setIdx}`] !== undefined ? timeInputs[`${exIdx}_${setIdx}`] : secondsToHHMMSS(set.reps)}
                                      placeholder="00:00"
                                      onChange={(e) => handleTimeInputChange(exIdx, setIdx, e.target.value)}
                                      onBlur={(e) => handleTimeInputBlur(exIdx, setIdx, e.target.value)}
                                      className="w-20 py-1 pr-2 text-right bg-black/5 rounded-lg border border-transparent focus:border-primary/40 focus:outline-none font-bold text-xs font-mono" 
                                    />
                                  ) : (
                                    <input 
                                      type="number" 
                                      inputMode="numeric"
                                      value={set.reps === 0 ? "" : set.reps}
                                      placeholder="0"
                                      onChange={(e) => updateSessionSet(exIdx, setIdx, "reps", e.target.value)}
                                      className="w-12 py-1 pr-2 text-right bg-black/5 rounded-lg border border-transparent focus:border-primary/40 focus:outline-none font-bold text-xs" 
                                    />
                                  )}
                                </td>
                                <td className="py-2 text-center pr-2">
                                  <input 
                                    type="text" 
                                    inputMode="decimal"
                                    value={set.rpe === undefined || set.rpe === null || set.rpe === 0 ? "" : set.rpe}
                                    placeholder="-"
                                    onChange={(e) => {
                                      const raw = e.target.value.replace(",", ".");
                                      if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
                                        setSessionExercises((prev) => {
                                          const copy = JSON.parse(JSON.stringify(prev));
                                          copy[exIdx].sets[setIdx].rpe = raw;
                                          return copy;
                                        });
                                      }
                                    }}
                                    className="w-10 py-1 text-center bg-black/5 dark:bg-white/5 rounded-lg border border-transparent focus:border-primary/40 focus:outline-none font-bold text-xs" 
                                  />
                                </td>
                                <td className="py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeSessionSet(exIdx, setIdx)}
                                    className="text-red-500 hover:text-red-600 active:scale-90 transition-transform"
                                    title="Rimuovi serie"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <button 
                        type="button"
                        onClick={() => addSessionSet(exIdx)}
                        className="w-full py-1.5 text-primary hover:bg-primary/5 rounded-lg border border-dashed border-primary/20 font-bold text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all"
                      >
                        <Plus size={12} /> Serie
                      </button>

                      {/* Sensazioni / Feedback Esercizio */}
                      <div className="mt-3 pt-2.5 border-t border-black/5 dark:border-white/5 flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-0.5">
                          Sensazioni Esercizio (Feedback Atleta)
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Scrivi come ti è sembrato l'esercizio..."
                          value={ex.feedback || ""}
                          onChange={(e) => {
                            const text = e.target.value;
                            setSessionExercises((prev) => {
                              const copy = JSON.parse(JSON.stringify(prev));
                              copy[exIdx].feedback = text;
                              return copy;
                            });
                          }}
                          className="glass-input w-full px-3 py-2 rounded-xl text-[9px] placeholder:text-[9px] outline-none font-medium resize-none text-zinc-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-600 bg-black/5 dark:bg-white/5 focus:bg-white dark:focus:bg-zinc-950 border border-transparent focus:border-primary/30 transition-all duration-200"
                        />
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setIsAddExerciseOpen(true)}
                  className="w-full py-3.5 mt-2 bg-white/60 hover:bg-white/95 dark:bg-zinc-900/60 dark:hover:bg-zinc-900/95 text-primary font-bold text-sm rounded-2xl flex items-center justify-center gap-2 border border-dashed border-primary/30 active:scale-[0.98] transition-all duration-200"
                >
                  <Plus size={16} /> Aggiungi Esercizio
                </button>
              </div>
            </div>

            {syncStatus === "error" && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center font-medium mb-2 animate-fade-in">
                {syncErrorMsg}
              </div>
            )}
            {syncStatus === "success" && (
              <div className="p-3.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-xs text-center font-bold mb-2 animate-fade-in">
                Sincronizzato con successo su Google Sheets! ✓
              </div>
            )}

            {session && session.user?.email && session.user.email !== "demo@strongvmax.com" ? (
              <button
                type="button"
                onClick={() => handleSyncPastWorkout(editingSession)}
                disabled={isSyncing}
                className="w-full py-3.5 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/95 hover:to-blue-600/95 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-primary/10 active:scale-95 transition-all duration-200 mb-2 mt-4 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" className={isSyncing ? "animate-spin" : ""}>
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                {isSyncing ? "Sincronizzazione in corso..." : "Sincronizza su Google Sheets (Scheda Cata 21)"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: window.location.href })}
                className="w-full py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all duration-200 mb-2 mt-4 cursor-pointer"
              >
                <span>Accedi con Google per sincronizzare (Scheda Cata 21)</span>
              </button>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-primary hover:bg-primary/95 text-white font-bold text-base rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all duration-200 mt-2"
            >
              Salva Modifiche
            </button>
          </form>
        </div>
      )}

      {/* Add Exercise Modal (Catalog Browser) inside History Editor */}
      {isAddExerciseOpen && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-lg rounded-t-3xl p-6 h-[80vh] flex flex-col gap-4 ios-modal-animate border-x-0 border-b-0 bg-[#f5f6fa] dark:bg-zinc-900">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-foreground">Aggiungi Esercizio</h2>
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
                  className="p-1.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 transition-all text-foreground"
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
                className="glass-input w-full px-4 py-3 rounded-xl text-sm outline-none bg-white dark:bg-zinc-950 text-foreground border border-black/5"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredCatalog.map((ex) => (
                <div 
                  key={ex.id}
                  onClick={() => selectSessionExercise(ex)}
                  className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-white dark:bg-zinc-800 hover:bg-black/5 dark:hover:bg-zinc-700 transition-all cursor-pointer flex justify-between items-center active:scale-[0.98] text-foreground"
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

      {/* Create Custom Exercise Modal Inline inside History Editor */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[140] bg-[#f5f6fa] dark:bg-zinc-950 flex flex-col p-5 ios-modal-animate pb-safe overflow-hidden">
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
              Crea & Aggiungi
            </button>
          </form>
        </div>
      )}

      {/* Profile Bottom Sheet Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-all duration-300" onClick={() => setIsProfileOpen(false)}>
          <div 
            className="w-full max-w-md glass-panel bg-white/95 dark:bg-gray-900/95 border-t border-white/30 dark:border-white/10 rounded-t-[30px] p-6 pb-8 flex flex-col gap-6 shadow-2xl transition-transform duration-300 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Indicator handle */}
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto -mt-2 mb-2"></div>

            {/* Header info */}
            <div className="flex items-center gap-4 border-b border-black/5 dark:border-white/5 pb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border border-white/30 dark:border-white/10 ring-4 ring-primary/20 flex items-center justify-center bg-black/5 dark:bg-white/5">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || "Profilo"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-primary flex items-center justify-center">
                    {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : <User size={24} />}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold font-sans text-foreground leading-tight truncate">
                  {session?.user?.name || "Ospite"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {session?.user?.email || "Effettua l'accesso per sincronizzare"}
                </p>
              </div>
            </div>

            {/* Apple Theme Selector */}
            <ThemeToggle />

            {/* Status indicators */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Integrazioni e Stato</h4>
              
              {session && session.user?.email && session.user.email !== "demo@strongvmax.com" ? (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-green-500/10 dark:bg-green-500/5 border border-green-500/20 text-green-700 dark:text-green-400">
                  <CheckCircle2 size={20} className="shrink-0" />
                  <div className="text-xs">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>Google Sheets Auto-Sync Attivo</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-700 dark:text-green-300 font-medium">Scheda Cata 21</span>
                    </div>
                    <div className="opacity-90 mt-0.5">I tuoi allenamenti vengono sincronizzati automaticamente su Google Fogli ({session.user.email}).</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                    <AlertCircle size={20} className="shrink-0" />
                    <div className="text-xs">
                      <div className="font-bold">Modalità Locale (Ospite)</div>
                      <div className="opacity-90 mt-0.5">I dati sono salvati in locale su questo dispositivo. Per sincronizzare su &apos;Scheda Cata 21&apos;, accedi con Google.</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      signIn("google", { callbackUrl: window.location.href });
                    }}
                    className="w-full p-3.5 rounded-2xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md shadow-primary/20 cursor-pointer"
                  >
                    <span>Connetti Account Google (Scheda Cata 21)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Backup & Transfer Data Section */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Backup & Trasferimento Dati</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  title="Scarica e copia un backup completo di tutti i tuoi dati"
                >
                  <Download size={18} className="text-primary" />
                  <span className="text-[11.5px] font-bold text-foreground">
                    {backupCopyFeedback ? "Copiato! ✅" : "Esporta Dati"}
                  </span>
                  <span className="text-[9.5px] text-gray-400 leading-none">Salva o copia JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setIsBackupModalOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  title="Ripristina o trasferisci dati incollando un backup"
                >
                  <Upload size={18} className="text-emerald-500" />
                  <span className="text-[11.5px] font-bold text-foreground">Importa Dati</span>
                  <span className="text-[9.5px] text-gray-400 leading-none">Incolla o ripristina</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {session && (
                <button
                  onClick={() => {
                    signOut({ callbackUrl: "/login" });
                  }}
                  className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 active:scale-95 transition-all duration-200"
                >
                  <LogOut size={18} />
                  Disconnetti Account
                </button>
              )}

              <button
                onClick={() => setIsProfileOpen(false)}
                className="w-full py-3.5 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-2xl active:scale-95 transition-all duration-200 border border-black/5 dark:border-white/5"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Backup Modal */}
      {isBackupModalOpen && (
        <div 
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setIsBackupModalOpen(false)}
        >
          <div 
            className="w-full max-w-sm glass-panel bg-white/95 dark:bg-zinc-900/95 border border-black/10 dark:border-white/10 rounded-[28px] p-5 shadow-2xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-black/5 dark:border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <Upload size={18} className="text-emerald-500" />
                <h3 className="text-base font-extrabold text-foreground">Importa Dati / Storico</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsBackupModalOpen(false)}
                className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-gray-500 hover:text-foreground"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Incolla qui sotto il codice JSON di backup esportato dalla vecchia app per ripristinare istantaneamente routine, schede e storico degli allenamenti:
            </p>

            <div className="flex flex-col gap-2">
              <textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='Incolla qui il JSON di backup (es. {"vmax_history": ...})'
                rows={5}
                className="w-full text-xs font-mono p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-foreground resize-none focus:outline-none focus:border-primary/50"
              />

              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setImportJsonText(text);
                  } catch {
                    alert("Impossibile leggere gli appunti automaticamente, incolla manualmente nella casella.");
                  }
                }}
                className="py-2 px-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-[11px] font-bold text-gray-600 dark:text-gray-300 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <Copy size={13} /> Incolla da Appunti
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(false)}
                className="flex-1 py-3 rounded-2xl border border-black/10 dark:border-white/10 text-xs font-bold text-gray-500 hover:text-foreground active:scale-95 transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleImportBackup}
                disabled={!importJsonText.trim()}
                className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-black shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
              >
                Ripristina Dati
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Calendar Drawer Modal */}
      {isCalendarOpen && (
        <div 
          className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-all duration-300"
          onClick={() => setIsCalendarOpen(false)}
        >
          <div 
            className="w-full max-w-md glass-panel bg-white/95 dark:bg-zinc-950/95 border-t border-white/30 dark:border-white/10 rounded-t-[30px] p-6 pb-8 flex flex-col gap-5 shadow-2xl transition-transform duration-300 pb-safe select-none"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Header Handle */}
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto -mt-2"></div>
            
            {/* Calendar Header with Controls */}
            <div className="flex justify-between items-center mt-1">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Attività Allenamenti
                </span>
                <span className="text-xl font-black text-primary font-sans leading-none mt-1">
                  Calendario Mensile
                </span>
              </div>
              <button 
                onClick={() => setIsCalendarOpen(false)}
                className="p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 transition-all text-gray-500 dark:text-gray-400"
              >
                <X size={18} />
              </button>
            </div>

            {/* Monthly Nav Bar */}
            <div 
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className="flex justify-between items-center bg-black/5 dark:bg-white/5 rounded-2xl p-2.5 border border-black/5 dark:border-white/5"
            >
              <button 
                onClick={handlePrevMonth}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-transform text-primary"
              >
                <ChevronLeft size={20} />
              </button>
              
              <span className="font-extrabold text-[15px] font-sans text-foreground">
                {getMonthNameItalian(calendarDate)}
              </span>
              
              <button 
                onClick={handleNextMonth}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-transform text-primary"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Days Column Labels */}
            <div className="grid grid-cols-7 gap-2.5 text-center text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
              {weekdaysLabels.map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </div>

            {/* Calendar Grid of Days */}
            <div className="grid grid-cols-7 gap-2 px-0.5">
              {getCalendarDays(calendarDate).map(({ day, monthOffset, dateObject }, index) => {
                const dayWorkouts = getWorkoutsForDate(dateObject);
                const hasWorkouts = dayWorkouts.length > 0;
                const isCurrentMonth = monthOffset === 0;
                
                let cellClass = "";
                if (isCurrentMonth) {
                  if (hasWorkouts) {
                    cellClass = "bg-gradient-to-tr from-primary to-cyan-400 text-white font-extrabold shadow-md scale-105 shadow-primary/20 border border-white/20";
                  } else {
                    cellClass = "bg-black/5 dark:bg-white/5 text-foreground hover:bg-black/10 dark:hover:bg-white/10 font-bold border border-transparent";
                  }
                } else {
                  cellClass = "text-gray-300 dark:text-zinc-800 bg-transparent opacity-25 font-medium border border-transparent pointer-events-none";
                }
                
                return (
                  <div key={index} className="flex flex-col items-center justify-center relative aspect-square">
                    <div 
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs transition-all relative ${cellClass}`}
                      title={hasWorkouts ? `${dayWorkouts.length} Allenamento/i` : undefined}
                    >
                      {day}
                      {hasWorkouts && isCurrentMonth && (
                        <span className="absolute -bottom-0.5 -right-0.5 bg-red-500 text-white font-black text-[8px] leading-none px-1 py-0.5 rounded-full border border-white dark:border-zinc-950 scale-90">
                          <Flame size={7} fill="currentColor" className="inline" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Monthly Recap Stat Box */}
            <div className="bg-gradient-to-tr from-primary/10 to-blue-500/10 dark:from-primary/5 dark:to-blue-500/5 rounded-2xl p-4 border border-primary/15 dark:border-primary/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white shadow-md shadow-primary/10">
                <Flame size={20} fill="currentColor" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Riepilogo Mensile
                </div>
                <div className="text-xs text-foreground font-semibold mt-0.5">
                  Nel mese di <span className="font-extrabold text-primary">{getMonthNameItalian(calendarDate).split(" ")[0]}</span> hai completato <span className="font-extrabold text-primary text-sm font-mono">{getMonthlyWorkoutCount(calendarDate)}</span> allenamenti!
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsCalendarOpen(false)}
              className="w-full py-3.5 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-2xl active:scale-95 transition-all duration-200 border border-black/5 dark:border-white/5"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
      </ModalPortal>
    </>
  );
}
