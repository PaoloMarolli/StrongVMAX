// Local-First Storage Utility for StrongVMAX PWA

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  isCustom: boolean;
}

export interface WorkoutSet {
  weight: number;
  reps: number;
  setOrder: number;
  rpe?: number;
  type?: string; // "N" (Normal), "W" (Warmup), "F" (Failure), "D" (Dropset)
}

export interface TemplateExerciseConfig {
  exerciseId: string;
  setsCount?: number;   // Number of sets (defaults to 3 if not set)
  restSeconds?: number; // Custom rest timer in seconds for this exercise in the routine
  targetReps?: string;  // Target reps or range (e.g. "8-10", "12")
  targetRpe?: number;   // Target RPE (e.g. 8, 8.5, 9)
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
  feedback?: string;
  restSeconds?: number; // Custom rest timer in seconds for this exercise
  targetReps?: string;  // Target reps or range
  targetRpe?: number;   // Target RPE
}

export interface WorkoutSession {
  id: string;
  name: string;
  date: string;
  durationSeconds: number;
  totalVolume: number;
  exercises: WorkoutExercise[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: (string | TemplateExerciseConfig)[]; // List of exercise IDs or detailed configs
  folderId?: string;   // Optional reference to a folder
}

export function normalizeTemplateExercise(entry: string | TemplateExerciseConfig): TemplateExerciseConfig {
  if (typeof entry === "string") {
    return {
      exerciseId: entry,
      setsCount: 3,
      restSeconds: 90,
    };
  }
  return {
    exerciseId: entry.exerciseId,
    setsCount: entry.setsCount && entry.setsCount > 0 ? entry.setsCount : 3,
    restSeconds: entry.restSeconds !== undefined && entry.restSeconds > 0 ? entry.restSeconds : 90,
    targetReps: entry.targetReps || "",
    targetRpe: entry.targetRpe,
  };
}

export interface WorkoutFolder {
  id: string;
  name: string;
  parentFolderId?: string; // Optional parent folder ID for nested subfolders
  createdAt?: number;       // Timestamp for sorting newest-first
}

const DEFAULT_EXERCISES: Exercise[] = [];

const DEFAULT_TEMPLATES: WorkoutTemplate[] = [];

// Helper to check if running in browser
const isClient = () => typeof window !== "undefined";

// Self-executing cache cleanup routine to remove old preset exercises/routines
if (isClient()) {
  try {
    const oldEx = localStorage.getItem("vmax_exercises");
    if (oldEx && (oldEx.includes('"e1"') || oldEx === "[]")) {
      localStorage.removeItem("vmax_exercises");
    }
    const oldTemp = localStorage.getItem("vmax_templates");
    if (oldTemp && (oldTemp.includes('"t1"') || oldTemp.includes('"Push Day"') || oldTemp === "[]")) {
      localStorage.removeItem("vmax_templates");
    }
  } catch {
    // Fail silently in case storage access is blocked
  }
}

export const storage = {
  // --- EXERCISES ---
  getExercises(): Exercise[] {
    if (!isClient()) return DEFAULT_EXERCISES;
    const data = localStorage.getItem("vmax_exercises");
    if (!data) {
      localStorage.setItem("vmax_exercises", JSON.stringify(DEFAULT_EXERCISES));
      return DEFAULT_EXERCISES;
    }
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse exercises from storage", e);
      return DEFAULT_EXERCISES;
    }
  },

  addExercise(name: string, muscleGroup: string, equipment: string): Exercise {
    const exercises = this.getExercises();
    const newExercise: Exercise = {
      id: "ex_" + Math.random().toString(36).substr(2, 9),
      name,
      muscleGroup,
      equipment,
      isCustom: true,
    };
    exercises.push(newExercise);
    if (isClient()) {
      localStorage.setItem("vmax_exercises", JSON.stringify(exercises));
    }
    return newExercise;
  },

  updateExercise(id: string, name: string, muscleGroup: string, equipment: string): Exercise {
    const exercises = this.getExercises();
    const index = exercises.findIndex(e => e.id === id);
    const updatedExercise: Exercise = {
      id,
      name,
      muscleGroup,
      equipment,
      isCustom: true,
    };
    if (index !== -1) {
      exercises[index] = updatedExercise;
    } else {
      exercises.push(updatedExercise);
    }
    if (isClient()) {
      localStorage.setItem("vmax_exercises", JSON.stringify(exercises));
    }
    return updatedExercise;
  },

  deleteExercise(id: string): void {
    const exercises = this.getExercises().filter(e => e.id !== id);
    if (isClient()) {
      localStorage.setItem("vmax_exercises", JSON.stringify(exercises));
    }
  },

  // --- TEMPLATES ---
  getTemplates(): WorkoutTemplate[] {
    if (!isClient()) return DEFAULT_TEMPLATES;
    const data = localStorage.getItem("vmax_templates");
    if (!data) {
      localStorage.setItem("vmax_templates", JSON.stringify(DEFAULT_TEMPLATES));
      return DEFAULT_TEMPLATES;
    }
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse templates from storage", e);
      return DEFAULT_TEMPLATES;
    }
  },

  saveTemplate(name: string, exercises: (string | TemplateExerciseConfig)[], folderId?: string): WorkoutTemplate {
    const templates = this.getTemplates();
    const newTemplate: WorkoutTemplate = {
      id: "temp_" + Math.random().toString(36).substr(2, 9),
      name,
      exercises,
      folderId,
    };
    templates.push(newTemplate);
    if (isClient()) {
      localStorage.setItem("vmax_templates", JSON.stringify(templates));
    }
    return newTemplate;
  },

  updateTemplate(id: string, name: string, exercises: (string | TemplateExerciseConfig)[], folderId?: string): WorkoutTemplate {
    const templates = this.getTemplates();
    const index = templates.findIndex(t => t.id === id);
    const updatedTemplate: WorkoutTemplate = { id, name, exercises, folderId };
    if (index !== -1) {
      templates[index] = updatedTemplate;
    } else {
      templates.push(updatedTemplate);
    }
    if (isClient()) {
      localStorage.setItem("vmax_templates", JSON.stringify(templates));
    }
    return updatedTemplate;
  },

  deleteTemplate(id: string): void {
    const templates = this.getTemplates().filter(t => t.id !== id);
    if (isClient()) {
      localStorage.setItem("vmax_templates", JSON.stringify(templates));
    }
  },

  // --- FOLDERS ---
  getFolders(): WorkoutFolder[] {
    if (!isClient()) return [];
    const data = localStorage.getItem("vmax_folders");
    if (!data) return [];
    try {
      const parsed: WorkoutFolder[] = JSON.parse(data);
      // Ensure all folders have createdAt for stable newest-first sorting
      return parsed.map((f, idx) => ({
        ...f,
        createdAt: f.createdAt || (Date.now() - (parsed.length - idx) * 1000),
      }));
    } catch (e) {
      console.error("Failed to parse folders from storage", e);
      return [];
    }
  },

  saveFolder(name: string, parentFolderId?: string): WorkoutFolder {
    const folders = this.getFolders();
    const newFolder: WorkoutFolder = {
      id: "fold_" + Math.random().toString(36).substr(2, 9),
      name,
      parentFolderId: parentFolderId || undefined,
      createdAt: Date.now(),
    };
    folders.unshift(newFolder); // Most recent folder first
    if (isClient()) {
      localStorage.setItem("vmax_folders", JSON.stringify(folders));
    }
    return newFolder;
  },

  updateFolder(id: string, name: string, parentFolderId?: string): WorkoutFolder {
    const folders = this.getFolders();
    const index = folders.findIndex(f => f.id === id);
    const existing = index !== -1 ? folders[index] : null;
    const updated: WorkoutFolder = {
      id,
      name,
      parentFolderId: parentFolderId !== undefined ? (parentFolderId || undefined) : existing?.parentFolderId,
      createdAt: existing?.createdAt || Date.now(),
    };
    if (index !== -1) {
      folders[index] = updated;
    } else {
      folders.unshift(updated);
    }
    if (isClient()) {
      localStorage.setItem("vmax_folders", JSON.stringify(folders));
    }
    return updated;
  },

  deleteFolder(id: string): void {
    const folders = this.getFolders();
    // When deleting a parent folder, subfolders under it have their parentFolderId cleared so they aren't lost
    const updatedFolders = folders
      .filter(f => f.id !== id)
      .map(f => f.parentFolderId === id ? { ...f, parentFolderId: undefined } : f);

    if (isClient()) {
      localStorage.setItem("vmax_folders", JSON.stringify(updatedFolders));
    }
    // Set folderId to undefined for templates directly under this folder so they aren't lost
    const templates = this.getTemplates();
    let changed = false;
    templates.forEach(t => {
      if (t.folderId === id) {
        delete t.folderId;
        changed = true;
      }
    });
    if (changed && isClient()) {
      localStorage.setItem("vmax_templates", JSON.stringify(templates));
    }
  },

  // --- WORKOUT HISTORY ---
  getHistory(): WorkoutSession[] {
    if (!isClient()) return [];
    const data = localStorage.getItem("vmax_history");
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse history from storage", e);
      return [];
    }
  },

  saveWorkout(session: Omit<WorkoutSession, "id" | "date">): WorkoutSession {
    const history = this.getHistory();
    const newSession: WorkoutSession = {
      ...session,
      id: "work_" + Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
    };
    history.unshift(newSession); // Add at the beginning (newest first)
    if (isClient()) {
      localStorage.setItem("vmax_history", JSON.stringify(history));
    }
    return newSession;
  },

  updateWorkout(session: WorkoutSession): WorkoutSession {
    const history = this.getHistory();
    const index = history.findIndex(s => s.id === session.id);
    if (index !== -1) {
      history[index] = session;
    }
    if (isClient()) {
      localStorage.setItem("vmax_history", JSON.stringify(history));
    }
    return session;
  },

  deleteWorkout(id: string): void {
    const history = this.getHistory().filter(s => s.id !== id);
    if (isClient()) {
      localStorage.setItem("vmax_history", JSON.stringify(history));
    }
  },

  getExerciseRestSeconds(exerciseId: string, defaultSeconds = 90): number {
    if (!isClient()) return defaultSeconds;
    const val = localStorage.getItem(`vmax_rest_${exerciseId}`);
    return val ? parseInt(val, 10) || defaultSeconds : defaultSeconds;
  },

  setExerciseRestSeconds(exerciseId: string, seconds: number): void {
    if (isClient()) {
      localStorage.setItem(`vmax_rest_${exerciseId}`, seconds.toString());
    }
  },

  exportBackup(): string {
    if (!isClient()) return "{}";
    const backup: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("vmax_") || key === "default_rest_seconds" || key === "theme")) {
        backup[key] = localStorage.getItem(key) || "";
      }
    }
    return JSON.stringify(backup, null, 2);
  },

  importBackup(jsonStr: string): boolean {
    if (!isClient()) return false;
    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed !== "object" || parsed === null) return false;
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") {
          localStorage.setItem(k, v);
        }
      }
      return true;
    } catch (e) {
      console.error("Failed to import backup", e);
      return false;
    }
  },
};

export function calculateSetVolume(weight: number, reps: number, type?: string, isDuration = false): number {
  if (isDuration) return weight > 0 ? weight : reps;
  const sType = type || "N";
  if (sType === "W") return 0; // Warmup sets do not count toward effective working volume
  return weight * reps;
}
