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

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
  feedback?: string;
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
  exercises: string[]; // List of exercise IDs
  folderId?: string;   // Optional reference to a folder
}

export interface WorkoutFolder {
  id: string;
  name: string;
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

  saveTemplate(name: string, exerciseIds: string[], folderId?: string): WorkoutTemplate {
    const templates = this.getTemplates();
    const newTemplate: WorkoutTemplate = {
      id: "temp_" + Math.random().toString(36).substr(2, 9),
      name,
      exercises: exerciseIds,
      folderId,
    };
    templates.push(newTemplate);
    if (isClient()) {
      localStorage.setItem("vmax_templates", JSON.stringify(templates));
    }
    return newTemplate;
  },

  updateTemplate(id: string, name: string, exerciseIds: string[], folderId?: string): WorkoutTemplate {
    const templates = this.getTemplates();
    const index = templates.findIndex(t => t.id === id);
    const updatedTemplate: WorkoutTemplate = { id, name, exercises: exerciseIds, folderId };
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
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse folders from storage", e);
      return [];
    }
  },

  saveFolder(name: string): WorkoutFolder {
    const folders = this.getFolders();
    const newFolder: WorkoutFolder = {
      id: "fold_" + Math.random().toString(36).substr(2, 9),
      name,
    };
    folders.push(newFolder);
    if (isClient()) {
      localStorage.setItem("vmax_folders", JSON.stringify(folders));
    }
    return newFolder;
  },

  updateFolder(id: string, name: string): WorkoutFolder {
    const folders = this.getFolders();
    const index = folders.findIndex(f => f.id === id);
    const updated = { id, name };
    if (index !== -1) {
      folders[index] = updated;
    }
    if (isClient()) {
      localStorage.setItem("vmax_folders", JSON.stringify(folders));
    }
    return updated;
  },

  deleteFolder(id: string): void {
    const folders = this.getFolders().filter(f => f.id !== id);
    if (isClient()) {
      localStorage.setItem("vmax_folders", JSON.stringify(folders));
    }
    // Set folderId to undefined for templates under this folder so they aren't lost
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
};

export function calculateSetVolume(weight: number, reps: number, type?: string, isDuration = false): number {
  if (isDuration) return weight > 0 ? weight : reps;
  const sType = type || "N";
  if (sType === "W") return 0; // Warmup sets do not count toward effective working volume
  return weight * reps;
}
