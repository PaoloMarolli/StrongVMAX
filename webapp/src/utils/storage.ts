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
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
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
    return JSON.parse(data);
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
    return JSON.parse(data);
  },

  saveTemplate(name: string, exerciseIds: string[]): WorkoutTemplate {
    const templates = this.getTemplates();
    const newTemplate: WorkoutTemplate = {
      id: "temp_" + Math.random().toString(36).substr(2, 9),
      name,
      exercises: exerciseIds,
    };
    templates.push(newTemplate);
    if (isClient()) {
      localStorage.setItem("vmax_templates", JSON.stringify(templates));
    }
    return newTemplate;
  },

  updateTemplate(id: string, name: string, exerciseIds: string[]): WorkoutTemplate {
    const templates = this.getTemplates();
    const index = templates.findIndex(t => t.id === id);
    const updatedTemplate: WorkoutTemplate = { id, name, exercises: exerciseIds };
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

  // --- WORKOUT HISTORY ---
  getHistory(): WorkoutSession[] {
    if (!isClient()) return [];
    const data = localStorage.getItem("vmax_history");
    return data ? JSON.parse(data) : [];
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
