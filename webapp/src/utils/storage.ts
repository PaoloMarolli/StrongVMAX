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
  restSeconds?: number; // Custom rest timer in seconds for this exercise in the routine (0 = no rest / immediate superset transition)
  targetReps?: string;  // Target reps or range (e.g. "8-10", "12")
  targetRpe?: number;   // Target RPE (e.g. 8, 8.5, 9)
  supersetId?: string;  // Optional superset group identifier shared by 2+ exercises
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
  feedback?: string;
  restSeconds?: number; // Custom rest timer in seconds for this exercise (0 = no rest)
  targetReps?: string;  // Target reps or range
  targetRpe?: number;   // Target RPE
  supersetId?: string;  // Optional superset group identifier shared by 2+ exercises
}

export interface SupersetColorTheme {
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  solidBg: string;
  accentBorder: string;
  connectorBg: string;
  connectorBorder: string;
}

export const SUPERSET_COLORS: SupersetColorTheme[] = [
  {
    badgeBg: "bg-violet-500/15",
    badgeText: "text-violet-600 dark:text-violet-400",
    badgeBorder: "border-violet-500/30",
    solidBg: "bg-violet-600 text-white",
    accentBorder: "border-l-4 border-l-violet-500",
    connectorBg: "bg-violet-500/10 hover:bg-violet-500/20",
    connectorBorder: "border-violet-500/30",
  },
  {
    badgeBg: "bg-cyan-500/15",
    badgeText: "text-cyan-600 dark:text-cyan-400",
    badgeBorder: "border-cyan-500/30",
    solidBg: "bg-cyan-600 text-white",
    accentBorder: "border-l-4 border-l-cyan-500",
    connectorBg: "bg-cyan-500/10 hover:bg-cyan-500/20",
    connectorBorder: "border-cyan-500/30",
  },
  {
    badgeBg: "bg-rose-500/15",
    badgeText: "text-rose-600 dark:text-rose-400",
    badgeBorder: "border-rose-500/30",
    solidBg: "bg-rose-600 text-white",
    accentBorder: "border-l-4 border-l-rose-500",
    connectorBg: "bg-rose-500/10 hover:bg-rose-500/20",
    connectorBorder: "border-rose-500/30",
  },
  {
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-600 dark:text-emerald-400",
    badgeBorder: "border-emerald-500/30",
    solidBg: "bg-emerald-600 text-white",
    accentBorder: "border-l-4 border-l-emerald-500",
    connectorBg: "bg-emerald-500/10 hover:bg-emerald-500/20",
    connectorBorder: "border-emerald-500/30",
  },
  {
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-600 dark:text-amber-400",
    badgeBorder: "border-amber-500/30",
    solidBg: "bg-amber-500 text-white",
    accentBorder: "border-l-4 border-l-amber-500",
    connectorBg: "bg-amber-500/10 hover:bg-amber-500/20",
    connectorBorder: "border-amber-500/30",
  },
];

export interface SupersetMeta {
  supersetId: string;
  groupLetter: string;       // "A", "B", "C"...
  groupTitle: string;        // "Superset A", "Triset A", "Giant Set A"
  label: string;             // "A1", "A2", "B1"...
  memberIndex: number;       // 0-based index within the superset
  totalMembers: number;      // total exercises in this superset (>= 2)
  isLastMember: boolean;     // true if last member in this superset
  connectedPrev: boolean;    // true if immediately preceded by an exercise with same supersetId
  connectedNext: boolean;    // true if immediately followed by an exercise with same supersetId
  colorIndex: number;        // index into SUPERSET_COLORS
  theme: SupersetColorTheme;
}

export function computeSupersetMap(
  items: { supersetId?: string }[]
): (SupersetMeta | null)[] {
  // Count occurrences of each supersetId
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    if (item.supersetId) {
      counts[item.supersetId] = (counts[item.supersetId] || 0) + 1;
    }
  });

  // Assign letters A, B, C... in order of first appearance for groups with >= 2 exercises
  const groupOrder: Record<string, number> = {};
  const seenCount: Record<string, number> = {};
  let nextGroupIdx = 0;

  return items.map((item, idx) => {
    const ssId = item.supersetId;
    if (!ssId || (counts[ssId] || 0) < 2) {
      return null;
    }

    if (groupOrder[ssId] === undefined) {
      groupOrder[ssId] = nextGroupIdx++;
      seenCount[ssId] = 0;
    }

    const gIdx = groupOrder[ssId];
    const mIdx = seenCount[ssId]++;
    const total = counts[ssId];
    const letter = String.fromCharCode(65 + (gIdx % 26)); // A, B, C...
    const prefix = total === 2 ? "Superset" : total === 3 ? "Triset" : "Giant Set";
    const colorIdx = gIdx % SUPERSET_COLORS.length;

    const prevId = idx > 0 ? items[idx - 1]?.supersetId : undefined;
    const nextId = idx < items.length - 1 ? items[idx + 1]?.supersetId : undefined;

    return {
      supersetId: ssId,
      groupLetter: letter,
      groupTitle: `${prefix} ${letter}`,
      label: `${letter}${mIdx + 1}`,
      memberIndex: mIdx,
      totalMembers: total,
      isLastMember: mIdx === total - 1,
      connectedPrev: prevId === ssId,
      connectedNext: nextId === ssId,
      colorIndex: colorIdx,
      theme: SUPERSET_COLORS[colorIdx],
    };
  });
}

export function toggleSupersetLinkBetween<T extends { supersetId?: string; restSeconds?: number }>(
  list: T[],
  idx: number,
  getDefaultRest: (item: T) => number = () => 90
): T[] {
  if (idx < 0 || idx >= list.length - 1) return list;
  const copy = list.map((item) => ({ ...item }));
  const current = copy[idx];
  const next = copy[idx + 1];

  const areLinked = Boolean(current.supersetId && current.supersetId === next.supersetId);

  if (areLinked) {
    // Unlink at boundary between idx and idx + 1
    const oldId = current.supersetId!;
    // Find all indices with oldId
    const indicesWithOldId = copy
      .map((it, i) => (it.supersetId === oldId ? i : -1))
      .filter((i) => i !== -1);

    const upperIndices = indicesWithOldId.filter((i) => i <= idx);
    const lowerIndices = indicesWithOldId.filter((i) => i >= idx + 1);

    if (upperIndices.length < 2) {
      upperIndices.forEach((i) => {
        copy[i].supersetId = undefined;
        if (copy[i].restSeconds === 0) {
          copy[i].restSeconds = getDefaultRest(copy[i]);
        }
      });
    }

    if (lowerIndices.length < 2) {
      lowerIndices.forEach((i) => {
        copy[i].supersetId = undefined;
        if (copy[i].restSeconds === 0) {
          copy[i].restSeconds = getDefaultRest(copy[i]);
        }
      });
    } else if (upperIndices.length >= 2) {
      // Both sides still have 2+ exercises -> split into two separate superset IDs
      const newLowerId = "ss_" + Math.random().toString(36).substr(2, 7);
      lowerIndices.forEach((i) => {
        copy[i].supersetId = newLowerId;
      });
      // Ensure the new last member of upper group has full rest if it was 0
      const lastUpperIdx = upperIndices[upperIndices.length - 1];
      if (copy[lastUpperIdx].restSeconds === 0) {
        copy[lastUpperIdx].restSeconds = getDefaultRest(copy[lastUpperIdx]);
      }
    }
  } else {
    // Link idx and idx + 1 into the same superset
    const targetId =
      current.supersetId ||
      next.supersetId ||
      "ss_" + Math.random().toString(36).substr(2, 7);

    // If both already belonged to different supersets, merge next's group into current's group
    if (current.supersetId && next.supersetId && current.supersetId !== next.supersetId) {
      const oldNextId = next.supersetId;
      copy.forEach((it) => {
        if (it.supersetId === oldNextId) {
          it.supersetId = targetId;
        }
      });
    } else {
      current.supersetId = targetId;
      next.supersetId = targetId;
    }

    // Set 0s rest on non-final members of this superset if they currently have default rest (e.g. 90s)
    const groupIndices = copy
      .map((it, i) => (it.supersetId === targetId ? i : -1))
      .filter((i) => i !== -1);

    groupIndices.forEach((gIdx, pos) => {
      const isLast = pos === groupIndices.length - 1;
      if (!isLast) {
        const defRest = getDefaultRest(copy[gIdx]);
        if (copy[gIdx].restSeconds === undefined || copy[gIdx].restSeconds === defRest) {
          copy[gIdx].restSeconds = 0;
        }
      } else {
        if (copy[gIdx].restSeconds === undefined || copy[gIdx].restSeconds === 0) {
          copy[gIdx].restSeconds = getDefaultRest(copy[gIdx]);
        }
      }
    });
  }

  return copy;
}

export function removeExerciseFromSuperset<T extends { supersetId?: string; restSeconds?: number }>(
  list: T[],
  idx: number,
  getDefaultRest: (item: T) => number = () => 90
): T[] {
  if (idx < 0 || idx >= list.length) return list;
  const targetId = list[idx].supersetId;
  if (!targetId) return list;

  const copy = list.map((item) => ({ ...item }));
  copy[idx].supersetId = undefined;
  if (copy[idx].restSeconds === 0) {
    copy[idx].restSeconds = getDefaultRest(copy[idx]);
  }

  // Check remaining members of targetId
  const remaining = copy
    .map((it, i) => (it.supersetId === targetId ? i : -1))
    .filter((i) => i !== -1);

  if (remaining.length < 2) {
    remaining.forEach((i) => {
      copy[i].supersetId = undefined;
      if (copy[i].restSeconds === 0) {
        copy[i].restSeconds = getDefaultRest(copy[i]);
      }
    });
  } else {
    // Ensure the last remaining member has full rest
    const lastIdx = remaining[remaining.length - 1];
    if (copy[lastIdx].restSeconds === 0) {
      copy[lastIdx].restSeconds = getDefaultRest(copy[lastIdx]);
    }
  }

  return copy;
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
    restSeconds: entry.restSeconds !== undefined && entry.restSeconds >= 0 ? entry.restSeconds : 90,
    targetReps: entry.targetReps || "",
    targetRpe: entry.targetRpe,
    supersetId: entry.supersetId,
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

  duplicateTemplate(id: string, newName?: string, targetFolderId?: string): WorkoutTemplate | null {
    const templates = this.getTemplates();
    const source = templates.find(t => t.id === id);
    if (!source) return null;
    const clonedExercises = source.exercises.map(entry =>
      typeof entry === "string" ? entry : { ...entry }
    );
    const duplicated: WorkoutTemplate = {
      id: "temp_" + Math.random().toString(36).substr(2, 9),
      name: (newName && newName.trim()) ? newName.trim() : source.name,
      exercises: clonedExercises,
      folderId: targetFolderId !== undefined ? (targetFolderId || undefined) : source.folderId,
    };
    templates.push(duplicated);
    if (isClient()) {
      localStorage.setItem("vmax_templates", JSON.stringify(templates));
    }
    return duplicated;
  },

  moveTemplate(id: string, targetFolderId?: string, newName?: string): WorkoutTemplate | null {
    const templates = this.getTemplates();
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) return null;
    const existing = templates[index];
    const updated: WorkoutTemplate = {
      ...existing,
      name: (newName && newName.trim()) ? newName.trim() : existing.name,
      folderId: targetFolderId || undefined,
    };
    templates[index] = updated;
    if (isClient()) {
      localStorage.setItem("vmax_templates", JSON.stringify(templates));
    }
    return updated;
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
