"use client";

import React, { useState, useEffect } from "react";
import { Plus, Play, Dumbbell, X, Check, Trash2, GripVertical, Folder, FolderPlus, ChevronDown, ChevronRight, Edit2, Timer, Target, Search } from "lucide-react";
import { useWorkout } from "@/context/WorkoutContext";
import { storage, WorkoutTemplate, WorkoutFolder, Exercise, WorkoutExercise, WorkoutSet, TemplateExerciseConfig, normalizeTemplateExercise } from "@/utils/storage";
import ThemeQuickToggle from "@/components/ThemeQuickToggle";
import ModalPortal from "@/components/ModalPortal";

export default function RoutineView() {
  const { startWorkout, setBottomBarVisible, isBottomBarVisible, isActive, isMinimized } = useWorkout();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  
  // Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<TemplateExerciseConfig[]>([]);

  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");

  // Rest Timer Modal State for Routine Editor
  const [editingRestTimerIndex, setEditingRestTimerIndex] = useState<number | null>(null);
  const [tempRestSeconds, setTempRestSeconds] = useState(90);

  // Target RPE Modal State for Routine Editor
  const [editingRpeIndex, setEditingRpeIndex] = useState<number | null>(null);

  // Detail Modal State
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailTemplate, setDetailTemplate] = useState<WorkoutTemplate | null>(null);

  // Drag and Drop touch states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [currentTouchY, setCurrentTouchY] = useState<number>(0);
  const touchStartY = React.useRef<number>(0);
  const itemsRects = React.useRef<{ top: number; bottom: number; height: number; center: number }[]>([]);

  // Inner Exercise Creator State
  const [isInnerAddExerciseOpen, setIsInnerAddExerciseOpen] = useState(false);
  const [innerName, setInnerName] = useState("");
  const [innerMuscleGroup, setInnerMuscleGroup] = useState("Petto");
  const [innerEquipment, setInnerEquipment] = useState("Bilanciere");
  const [innerBarbellPreset, setInnerBarbellPreset] = useState("Olimpico (20 kg)");
  const [innerCustomBarbellText, setInnerCustomBarbellText] = useState("");

  // Folder Feature State
  const [folders, setFolders] = useState<WorkoutFolder[]>([]);
  const [openFolderIds, setOpenFolderIds] = useState<Record<string, boolean>>({});
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderParentId, setFolderParentId] = useState<string>("");
  const [editingFolder, setEditingFolder] = useState<WorkoutFolder | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");

  // Load templates and exercises from local-first storage
  const loadData = () => {
    setTemplates(storage.getTemplates());
    setAllExercises(storage.getExercises());
    
    // Load folders
    const savedFolders = storage.getFolders();
    setFolders(savedFolders);

    // All folders start closed by default when the app opens
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartTemplate = (template: WorkoutTemplate) => {
    // Map template exercises to full active workout exercises structure
    const exercises: WorkoutExercise[] = template.exercises.map((entry) => {
      const config = normalizeTemplateExercise(entry);
      const found = allExercises.find((e) => e.id === config.exerciseId);
      const setsCount = config.setsCount && config.setsCount > 0 ? config.setsCount : 3;
      const sets: WorkoutSet[] = Array.from({ length: setsCount }, (_, i) => ({
        weight: 0,
        reps: 0,
        setOrder: i + 1,
      }));
      const restSeconds = config.restSeconds !== undefined && config.restSeconds > 0
        ? config.restSeconds
        : storage.getExerciseRestSeconds(config.exerciseId, 90);

      return {
        exerciseId: config.exerciseId,
        exerciseName: found ? found.name : "Esercizio",
        sets,
        restSeconds,
        targetReps: config.targetReps,
        targetRpe: config.targetRpe,
      };
    });

    startWorkout(template.name, exercises);
  };

  // Open Detail Modal
  const openDetail = (template: WorkoutTemplate) => {
    setDetailTemplate(template);
    setIsDetailOpen(true);
    setBottomBarVisible(false);
  };

  // Close Detail Modal
  const closeDetail = () => {
    setIsDetailOpen(false);
    setDetailTemplate(null);
    setBottomBarVisible(true);
  };

  // Open Creator Modal
  const openCreator = (defaultFolderId = "") => {
    setEditingTemplate(null);
    setTemplateName("");
    setSelectedExercises([]);
    setSelectedFolderId(defaultFolderId); // Set default folder if provided
    setCatalogSearchQuery("");
    setIsEditorOpen(true);
    setBottomBarVisible(false);
  };

  // Open Editor Modal
  const openEditor = (template: WorkoutTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    const normalized = template.exercises.map(normalizeTemplateExercise);
    setSelectedExercises(normalized);
    setSelectedFolderId(template.folderId || ""); // Set folder if exists
    setCatalogSearchQuery("");
    setIsEditorOpen(true);
    setBottomBarVisible(false);
  };

  // Close Editor Modal
  const closeEditor = () => {
    setCatalogSearchQuery("");
    setIsEditorOpen(false);
    setBottomBarVisible(true);
  };

  // Remove Selected Exercise
  const removeExerciseFromSelected = (id: string) => {
    setSelectedExercises((prev) => prev.filter((ex) => ex.exerciseId !== id));
  };

  // Toggle selection from catalog
  const toggleSelectExercise = (id: string) => {
    setSelectedExercises((prev) => {
      const exists = prev.some((ex) => ex.exerciseId === id);
      if (exists) {
        return prev.filter((ex) => ex.exerciseId !== id);
      } else {
        const defaultRest = storage.getExerciseRestSeconds(id, 90);
        return [
          ...prev,
          {
            exerciseId: id,
            setsCount: 3,
            restSeconds: defaultRest,
            targetReps: "",
            targetRpe: undefined,
          },
        ];
      }
    });
  };

  // Update specific exercise configuration in the routine
  const updateExerciseConfig = (index: number, updates: Partial<TemplateExerciseConfig>) => {
    setSelectedExercises((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    if (e.touches.length !== 1) return;
    const clientY = e.touches[0].clientY;
    touchStartY.current = clientY;
    setDraggedIndex(index);
    setHoveredIndex(index);
    setCurrentTouchY(clientY);

    // Measure all drag items inside the list
    const elements = document.querySelectorAll(".drag-item");
    const rects: { top: number; bottom: number; height: number; center: number }[] = [];
    elements.forEach((el) => {
      const r = el.getBoundingClientRect();
      rects.push({
        top: r.top,
        bottom: r.bottom,
        height: r.height,
        center: r.top + r.height / 2,
      });
    });
    itemsRects.current = rects;

    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(10);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (draggedIndex === null) return;

    if (e.cancelable) {
      e.preventDefault();
    }

    const currentY = e.touches[0].clientY;
    setCurrentTouchY(currentY);

    const rects = itemsRects.current;
    if (rects.length === 0) return;

    let targetIndex = draggedIndex;
    let minDistance = Infinity;

    rects.forEach((rect, idx) => {
      const dist = Math.abs(currentY - rect.center);
      if (dist < minDistance) {
        minDistance = dist;
        targetIndex = idx;
      }
    });

    if (targetIndex !== hoveredIndex && targetIndex >= 0 && targetIndex < selectedExercises.length) {
      setHoveredIndex(targetIndex);
    }
  };

  const handleTouchEnd = () => {
    if (draggedIndex !== null && hoveredIndex !== null && draggedIndex !== hoveredIndex) {
      setSelectedExercises((prev) => {
        const copy = [...prev];
        const [removed] = copy.splice(draggedIndex, 1);
        copy.splice(hoveredIndex, 0, removed);
        return copy;
      });
    }
    setDraggedIndex(null);
    setHoveredIndex(null);
  };

  const handleEditFromDetail = () => {
    if (!detailTemplate) return;
    const temp = detailTemplate;
    setIsDetailOpen(false);
    openEditor(temp);
  };

  const handleStartFromDetail = () => {
    if (!detailTemplate) return;
    handleStartTemplate(detailTemplate);
    closeDetail();
  };

  // Handle Template Save
  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) return;

    const fId = selectedFolderId || undefined;

    if (editingTemplate) {
      storage.updateTemplate(editingTemplate.id, templateName, selectedExercises, fId);
    } else {
      storage.saveTemplate(templateName, selectedExercises, fId);
    }

    loadData();
    closeEditor();
  };

  // Open Folder Modal helpers
  const openNewFolderModal = (parentFolderId = "") => {
    setEditingFolder(null);
    setFolderName("");
    setFolderParentId(parentFolderId);
    setIsFolderModalOpen(true);
    setBottomBarVisible(false);
  };

  const openEditFolderModal = (folder: WorkoutFolder) => {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setFolderParentId(folder.parentFolderId || "");
    setIsFolderModalOpen(true);
    setBottomBarVisible(false);
  };

  // Handle Folder Save/Rename
  const handleSaveFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    let savedId: string | null = null;
    if (editingFolder) {
      const updated = storage.updateFolder(editingFolder.id, folderName.trim(), folderParentId || undefined);
      savedId = updated.id;
    } else {
      const created = storage.saveFolder(folderName.trim(), folderParentId || undefined);
      savedId = created.id;
    }

    // Automatically expand the created folder (and its parent if subfolder)
    if (savedId) {
      setOpenFolderIds(prev => ({
        ...prev,
        [savedId!]: true,
        ...(folderParentId ? { [folderParentId]: true } : {}),
      }));
    }

    setFolderName("");
    setFolderParentId("");
    setEditingFolder(null);
    setIsFolderModalOpen(false);
    setBottomBarVisible(true);
    loadData();
  };

  // Handle Folder Delete
  const handleDeleteFolder = (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questa cartella? I template al suo interno non verranno cancellati, ma saranno spostati fuori.")) {
      storage.deleteFolder(id);
      loadData();
    }
  };

  // Handle Template Delete
  const handleDeleteTemplate = (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questa routine?")) {
      storage.deleteTemplate(id);
      loadData();
      closeEditor();
    }
  };

  // Handle Inner Exercise creation
  const handleCreateInnerExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!innerName.trim()) return;

    const finalEquipment = innerEquipment === "Bilanciere"
      ? (innerBarbellPreset === "Personalizzato" ? `Bilanciere - ${innerCustomBarbellText || "Olimpico"}` : `Bilanciere - ${innerBarbellPreset}`)
      : innerEquipment;

    const newEx = storage.addExercise(innerName, innerMuscleGroup, finalEquipment);
    
    // Refresh exercise catalog lists
    const updatedExercises = storage.getExercises();
    setAllExercises(updatedExercises);
    
    // Automatically add the newly created exercise in the active selection
    setSelectedExercises((prev) => [
      ...prev,
      {
        exerciseId: newEx.id,
        setsCount: 3,
        restSeconds: 90,
        targetReps: "",
        targetRpe: undefined,
      },
    ]);
    
    // Reset Form & Close Modal
    setInnerName("");
    setInnerMuscleGroup("Petto");
    setInnerEquipment("Bilanciere");
    setInnerBarbellPreset("Olimpico (20 kg)");
    setInnerCustomBarbellText("");
    setIsInnerAddExerciseOpen(false);
  };

  // Helper to get exercises names for a template
  const getTemplateExercisesSummary = (template: WorkoutTemplate) => {
    return template.exercises
      .map((entry) => {
        const id = typeof entry === "string" ? entry : entry.exerciseId;
        const found = allExercises.find((e) => e.id === id);
        return found ? found.name : null;
      })
      .filter(Boolean)
      .join(", ");
  };

  // Root folders (no parentFolderId, sorted newest-first per user requirement)
  const rootFolders = folders
    .filter(f => !f.parentFolderId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const validFolderIds = new Set(folders.map(f => f.id));
  const uncategorizedTemplates = templates.filter(t => !t.folderId || !validFolderIds.has(t.folderId));

  const isModalActive = !isBottomBarVisible || (isActive && !isMinimized);

  return (
    <>
      <div className={`flex flex-col h-full w-full relative z-0 ${isModalActive ? "apple-page-scaled" : ""}`}>
        <header className="glass-header flex justify-between items-center p-4 sticky top-0 z-10">
          <h1 className="text-3xl font-black font-sans tracking-tight">Routine</h1>
          <div className="flex items-center gap-1">
            <ThemeQuickToggle />
            <button 
              onClick={() => openCreator()}
              className="p-2 text-primary active:scale-95 transition-transform" 
              aria-label="Nuovo template"
            >
              <Plus size={24} />
            </button>
          </div>
        </header>
      
      <div className="p-4 flex-1 overflow-y-auto pb-20">
        <button 
          onClick={() => startWorkout("Workout libero", [])}
          className="w-full glass-panel bg-primary/80 dark:bg-primary/60 text-white text-[17px] font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 mb-6 active:scale-95 transition-all shadow-[0_8px_30px_rgb(0,87,255,0.25)] border-white/20 hover:bg-primary"
        >
          <Play size={20} fill="currentColor" className="stroke-[3px]" />
          Workout libero
        </button>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">I miei Template</h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => openNewFolderModal()}
                className="text-xs font-bold text-primary flex items-center gap-1 active:scale-95 transition-transform"
                title="Nuova Cartella"
              >
                <FolderPlus size={14} /> + Cartella
              </button>
              <span className="text-[10px] text-gray-400 font-bold">{templates.length} totali</span>
            </div>
          </div>

          {/* Grouped Folders List (Newest first, collapsed by default) */}
          {rootFolders.map((folder) => {
            const subfolders = folders
              .filter(f => f.parentFolderId === folder.id)
              .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || (a.createdAt || 0) - (b.createdAt || 0));

            const directTemplates = templates.filter(t => t.folderId === folder.id);
            const subfolderIds = new Set(subfolders.map(s => s.id));
            const allNestedTemplates = templates.filter(t => t.folderId && subfolderIds.has(t.folderId));
            const totalTemplatesCount = directTemplates.length + allNestedTemplates.length;

            const isOpen = !!openFolderIds[folder.id];

            return (
              <div key={folder.id} className="space-y-2.5">
                {/* Folder Header */}
                <div 
                  onClick={() => setOpenFolderIds(prev => ({ ...prev, [folder.id]: !isOpen }))}
                  className="flex items-center justify-between p-3.5 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isOpen ? (
                      <ChevronDown size={18} className="text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight size={18} className="text-gray-400 shrink-0" />
                    )}
                    <Folder size={18} className="text-primary shrink-0 fill-primary/10" />
                    <span className="font-extrabold text-[15px] truncate text-foreground">{folder.name}</span>
                    {subfolders.length > 0 && (
                      <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
                        {subfolders.length} sett.
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 font-bold bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full shrink-0">
                      {totalTemplatesCount}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openNewFolderModal(folder.id)}
                      className="px-2 py-1 text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/15 rounded-lg flex items-center gap-1 active:scale-90 transition-all"
                      title="Aggiungi sottocartella / settimana a questa cartella"
                    >
                      <FolderPlus size={12} />
                      <span className="hidden sm:inline">Sotto</span>cartella
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditFolderModal(folder)}
                      className="p-1.5 text-gray-400 hover:text-primary active:scale-90 transition-colors"
                      title="Rinomina Cartella"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFolder(folder.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 active:scale-90 transition-colors"
                      title="Elimina Cartella"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Folder Templates & Subfolders Content Accordion */}
                {isOpen && (
                  <div className="pl-3.5 border-l-2 border-primary/20 space-y-3 animate-in fade-in duration-200">
                    {/* Subfolders list */}
                    {subfolders.map((subfolder) => {
                      const subTemplates = templates.filter(t => t.folderId === subfolder.id);
                      const isSubOpen = !!openFolderIds[subfolder.id];

                      return (
                        <div key={subfolder.id} className="space-y-2 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 p-2.5">
                          {/* Subfolder Header */}
                          <div 
                            onClick={() => setOpenFolderIds(prev => ({ ...prev, [subfolder.id]: !isSubOpen }))}
                            className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.99] transition-all"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isSubOpen ? (
                                <ChevronDown size={16} className="text-gray-400 shrink-0" />
                              ) : (
                                <ChevronRight size={16} className="text-gray-400 shrink-0" />
                              )}
                              <Folder size={16} className="text-amber-500 shrink-0 fill-amber-500/10" />
                              <span className="font-bold text-[14px] truncate text-foreground">{subfolder.name}</span>
                              <span className="text-[9px] text-gray-400 font-bold bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full shrink-0">
                                {subTemplates.length}
                              </span>
                            </div>

                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => openCreator(subfolder.id)}
                                className="p-1.5 text-primary hover:bg-primary/10 rounded-lg active:scale-90 transition-colors"
                                title="Crea routine in questa sottocartella"
                              >
                                <Plus size={13} className="stroke-[3px]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditFolderModal(subfolder)}
                                className="p-1.5 text-gray-400 hover:text-primary active:scale-90 transition-colors"
                                title="Rinomina Sottocartella"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteFolder(subfolder.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 active:scale-90 transition-colors"
                                title="Elimina Sottocartella"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Subfolder Templates Accordion */}
                          {isSubOpen && (
                            <div className="pl-3 border-l-2 border-amber-500/30 space-y-2.5 pt-1 animate-in fade-in duration-200">
                              {subTemplates.map((template) => {
                                const summary = getTemplateExercisesSummary(template);
                                return (
                                  <div 
                                    key={template.id} 
                                    onClick={() => openDetail(template)}
                                    className="glass-panel p-3.5 rounded-xl border border-white/20 dark:border-white/5 shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                                  >
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <h3 className="text-[15px] font-extrabold text-foreground leading-tight">{template.name}</h3>
                                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-0.5">
                                          {template.exercises.length} Esercizi
                                        </span>
                                      </div>
                                      <span className="p-1.5 rounded-full bg-secondary/10 text-secondary shrink-0">
                                        <Dumbbell size={13} fill="currentColor" />
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-1 leading-normal font-medium">
                                      {summary || "Nessun esercizio inserito. Tocca per iniziare!"}
                                    </p>
                                  </div>
                                );
                              })}
                              {subTemplates.length === 0 && (
                                <div className="flex items-center justify-between p-3 text-xs text-gray-400 bg-black/[0.015] dark:bg-white/[0.01] rounded-xl border border-dashed border-black/5 dark:border-white/5">
                                  <span>Nessuna routine in questa sottocartella.</span>
                                  <button
                                    type="button"
                                    onClick={() => openCreator(subfolder.id)}
                                    className="text-[11px] font-bold text-primary active:scale-95"
                                  >
                                    + Aggiungi Routine
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Direct Templates in root folder */}
                    {directTemplates.length > 0 && (
                      <div className="space-y-2.5 pt-1">
                        {subfolders.length > 0 && (
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                            Altre Routine
                          </div>
                        )}
                        {directTemplates.map((template) => {
                          const summary = getTemplateExercisesSummary(template);
                          return (
                            <div 
                              key={template.id} 
                              onClick={() => openDetail(template)}
                              className="glass-panel p-4 rounded-xl border border-white/20 dark:border-white/5 shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h2 className="text-[16px] font-extrabold text-foreground leading-tight">{template.name}</h2>
                                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-0.5">
                                    {template.exercises.length} Esercizi
                                  </span>
                                </div>
                                <span className="p-1.5 rounded-full bg-secondary/10 text-secondary shrink-0">
                                  <Dumbbell size={14} fill="currentColor" />
                                </span>
                              </div>
                              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-2 line-clamp-1 leading-normal font-medium">
                                {summary || "Nessun esercizio inserito. Tocca per iniziare!"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Completely empty root folder */}
                    {directTemplates.length === 0 && subfolders.length === 0 && (
                      <div className="text-center p-4 text-xs text-gray-400 bg-black/[0.02] dark:bg-white/[0.01] rounded-xl border border-dashed border-black/5 dark:border-white/5 space-y-2">
                        <p>Cartella vuota. Crea delle sottocartelle (es. Settimana 1) o assegna direttamente delle routine.</p>
                        <div className="flex items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => openNewFolderModal(folder.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
                          >
                            + Sottocartella
                          </button>
                          <button
                            type="button"
                            onClick={() => openCreator(folder.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-black/5 dark:bg-white/10 text-foreground hover:bg-black/10 active:scale-95 transition-all"
                          >
                            + Routine
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Uncategorized / Single Templates */}
          {uncategorizedTemplates.length > 0 && (
            <div className="space-y-3 pt-2">
              {rootFolders.length > 0 && (
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                  Template Singoli
                </div>
              )}
              {uncategorizedTemplates.map((template) => {
                const summary = getTemplateExercisesSummary(template);
                return (
                  <div 
                    key={template.id} 
                    onClick={() => openDetail(template)}
                    className="glass-panel p-5 rounded-2xl border border-white/20 dark:border-white/5 shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-[19px] font-extrabold text-foreground leading-tight">{template.name}</h2>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-1">
                          {template.exercises.length} Esercizi
                        </span>
                      </div>
                      <span className="p-2 rounded-full bg-secondary/10 text-secondary shrink-0 active:scale-90 transition-transform">
                        <Dumbbell size={16} fill="currentColor" />
                      </span>
                    </div>
                    
                    <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-3 line-clamp-2 leading-relaxed font-medium">
                      {summary || "Nessun esercizio inserito. Tocca per visualizzare o iniziare!"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {templates.length === 0 && (
            <div className="p-8 text-center text-gray-500 font-medium bg-black/5 dark:bg-white/5 rounded-2xl border border-dashed border-black/10 dark:border-white/10">
              Nessun template personalizzato ancora creato. Tocca &ldquo;+&rdquo; in alto per iniziare a strutturare le tue routine!
            </div>
          )}
        </div>
      </div>
      </div>

      {/* 100% Fullscreen Native Modal Sheet for Routine Detail (iOS Style) */}
      <ModalPortal>
      {isDetailOpen && detailTemplate && (
        <div className="fixed inset-0 z-[115] bg-[#f5f6fa] flex flex-col p-6 overflow-hidden ios-modal-animate pb-safe">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-black/5 mb-4">
            <h2 className="text-xl font-bold font-sans truncate pr-4">
              {detailTemplate.name}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEditFromDetail}
                className="px-4 py-2 rounded-full text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
              >
                Modifica
              </button>
              <button 
                onClick={closeDetail}
                className="p-2 rounded-full bg-black/5 hover:bg-black/10 active:scale-95 transition-all"
                aria-label="Chiudi"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body Content - Ordered Exercises List */}
          <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full overflow-hidden">
            <div className="flex flex-col gap-1.5 overflow-hidden flex-1 mb-4">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Esercizi Ordinati in questa Routine</label>
              
              {detailTemplate.exercises.length === 0 ? (
                <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-black/10 dark:border-white/5 text-xs text-gray-400 font-semibold leading-relaxed flex flex-col items-center justify-center gap-3 flex-1">
                  Nessun esercizio in questa routine. Tocca &ldquo;Modifica&rdquo; in alto a destra per aggiungerne!
                </div>
              ) : (
                <div className="overflow-y-auto space-y-2 pr-1 flex-1 pb-4">
                  {detailTemplate.exercises.map((entry, index) => {
                    const config = normalizeTemplateExercise(entry);
                    const found = allExercises.find((e) => e.id === config.exerciseId);
                    if (!found) return null;
                    const rest = config.restSeconds || storage.getExerciseRestSeconds(config.exerciseId, 90);
                    return (
                      <div 
                        key={index} 
                        className="p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between shadow-sm"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="font-semibold text-[15px] truncate">{found.name}</div>
                          <span className="text-[9px] text-gray-400 uppercase tracking-wider block mb-1.5">{found.muscleGroup} • {found.equipment}</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                              {config.setsCount || 3} Serie
                            </span>
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Timer size={10} className="stroke-[2.5px]" />
                              {Math.floor(rest / 60)}m {rest % 60 ? `${rest % 60}s` : "00s"}
                            </span>
                            {config.targetReps && (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Target size={10} className="stroke-[2.5px]" /> {config.targetReps} reps
                              </span>
                            )}
                            {config.targetRpe && (
                              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
                                @{config.targetRpe} RPE
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg font-mono font-bold text-gray-400 shrink-0">
                          {index + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Inizia Allenamento Button */}
            <button
              onClick={handleStartFromDetail}
              className="w-full py-4 bg-secondary hover:bg-secondary/95 text-white font-bold text-base rounded-2xl shadow-lg shadow-secondary/20 active:scale-95 transition-all duration-200"
            >
              Inizia Allenamento
            </button>
          </div>
        </div>
      )}

      {/* 100% Fullscreen Native Modal Sheet for Routine Editor (iOS Style) */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-[120] bg-[#f5f6fa] flex flex-col p-6 overflow-hidden ios-modal-animate pb-safe">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-black/5 mb-4">
            <h2 className="text-xl font-bold font-sans">
              {editingTemplate ? "Modifica Routine" : "Nuova Routine"}
            </h2>
            <div className="flex items-center gap-2">
              {editingTemplate && (
                <button
                  type="button"
                  onClick={() => handleDeleteTemplate(editingTemplate.id)}
                  className="p-2 rounded-full text-red-500 hover:bg-red-500/10 active:scale-90 transition-all animate-in fade-in"
                  title="Elimina Routine"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button 
                onClick={closeEditor}
                className="p-2 rounded-full bg-black/5 hover:bg-black/10 active:scale-95 transition-all"
                aria-label="Chiudi"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveTemplate} className="flex flex-col gap-4 overflow-hidden flex-1 max-w-md mx-auto w-full">
            <div className="flex flex-col gap-1.5 overflow-hidden flex-1">
              <div className="flex-1 overflow-y-auto pr-1 space-y-5 pb-4">
                
                {/* Nome Routine */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome Routine</label>
                  <input
                    type="text"
                    placeholder="Es. Spinta, Petto e Tricipiti"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="glass-input w-full px-4 py-3.5 rounded-xl text-base outline-none font-medium"
                    required
                  />
                </div>

                {/* Selezione Cartella */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cartella</label>
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="glass-input w-full px-4 py-3.5 rounded-xl text-base outline-none appearance-none font-semibold bg-white dark:bg-zinc-800 text-foreground"
                  >
                    <option value="">Nessuna cartella (Template Singolo)</option>
                    {rootFolders.map((root) => {
                      const rootSubs = folders
                        .filter(f => f.parentFolderId === root.id)
                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

                      return (
                        <React.Fragment key={root.id}>
                          <option value={root.id} className="font-bold">
                            📁 {root.name}
                          </option>
                          {rootSubs.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              &nbsp;&nbsp;&nbsp;&nbsp;↳ 📂 {sub.name}
                            </option>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </select>
                </div>

                {/* Selected Exercises Reordering & Configuration List */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Esercizi Inclusi (Tieni premuto per ordinare)</label>
                  {selectedExercises.length === 0 ? (
                    <div className="text-center p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-black/10 dark:border-white/5 text-xs text-gray-400 font-semibold leading-relaxed">
                      Nessun esercizio aggiunto. Seleziona gli esercizi dal catalogo sottostante.
                    </div>
                  ) : (
                    <div className="space-y-2.5 select-none relative">
                      {selectedExercises.map((config, idx) => {
                        const ex = allExercises.find((e) => e.id === config.exerciseId);
                        if (!ex) return null;
                        
                        const isDraggingAny = draggedIndex !== null;
                        const isCurrentDragged = draggedIndex === idx;

                        let translateY = 0;
                        let transitionStyle = "";

                        if (isDraggingAny) {
                          if (isCurrentDragged) {
                            translateY = currentTouchY - touchStartY.current;
                            transitionStyle = "none";
                          } else {
                            const draggedHeight = itemsRects.current[draggedIndex]?.height || 80;
                            if (hoveredIndex !== null) {
                              if (draggedIndex < hoveredIndex && idx > draggedIndex && idx <= hoveredIndex) {
                                translateY = -draggedHeight;
                              } else if (draggedIndex > hoveredIndex && idx < draggedIndex && idx >= hoveredIndex) {
                                translateY = draggedHeight;
                              }
                            }
                            transitionStyle = "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)";
                          }
                        } else {
                          transitionStyle = "transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease";
                        }

                        const restSec = config.restSeconds || storage.getExerciseRestSeconds(config.exerciseId, 90);

                        return (
                          <div
                            key={`${config.exerciseId}_${idx}`}
                            className={`drag-item select-none flex flex-col gap-2.5 rounded-2xl border shadow-sm ${
                              isDraggingAny
                                ? isCurrentDragged
                                  ? "p-4 bg-primary/10 border-primary/40 text-primary scale-105 shadow-xl z-30 ring-2 ring-primary/20 cursor-grabbing touch-none"
                                  : "p-3 scale-[0.96] border-black/5 dark:border-white/5 bg-white dark:bg-zinc-900 text-gray-400 opacity-100"
                                : "p-3.5 bg-white dark:bg-zinc-900 border-black/5 dark:border-white/5 text-foreground hover:border-black/10 dark:hover:border-white/10 cursor-default"
                            }`}
                            style={{
                              transform: `translateY(${translateY}px)`,
                              transition: transitionStyle,
                              WebkitUserSelect: "none",
                              WebkitTouchCallout: "none",
                              zIndex: isCurrentDragged ? 50 : 1,
                              position: "relative"
                            }}
                          >
                            {/* Exercise Name & Reorder Row */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                <div
                                  onTouchStart={(e) => handleTouchStart(e, idx)}
                                  onTouchMove={handleTouchMove}
                                  onTouchEnd={handleTouchEnd}
                                  onTouchCancel={handleTouchEnd}
                                  className="text-gray-400 p-1.5 bg-black/5 hover:bg-black/10 dark:bg-white/5 rounded-lg cursor-grab active:scale-110 active:text-primary transition-all shrink-0 touch-none"
                                  style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
                                >
                                  <GripVertical size={16} />
                                </div>
                                <div className="flex-1 min-w-0 pointer-events-none">
                                  <div className="text-[14px] font-bold truncate text-zinc-900 dark:text-zinc-50">{ex.name}</div>
                                  <span className="text-[9px] text-gray-400 uppercase tracking-wider">{ex.muscleGroup} • {ex.equipment}</span>
                                </div>
                              </div>
                              
                              <button
                                type="button"
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={() => removeExerciseFromSelected(config.exerciseId)}
                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-500 active:scale-90 transition-all shrink-0 cursor-pointer"
                                title="Rimuovi dalla Routine"
                              >
                                <X size={15} />
                              </button>
                            </div>

                            {/* Custom Controls Row (Sets count, Rest Timer, Target Reps & Target RPE) */}
                            <div className="pt-2 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center gap-2">
                              {/* Serie Stepper */}
                              <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-xl p-0.5 border border-black/5 dark:border-white/10 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => updateExerciseConfig(idx, { setsCount: Math.max(1, (config.setsCount || 3) - 1) })}
                                  className="w-7 h-7 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 active:scale-90 flex items-center justify-center font-bold text-sm shadow-sm transition-all cursor-pointer"
                                  title="Diminuisci serie"
                                >
                                  -
                                </button>
                                <span className="px-2 text-xs font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                                  {config.setsCount || 3} Serie
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateExerciseConfig(idx, { setsCount: Math.min(20, (config.setsCount || 3) + 1) })}
                                  className="w-7 h-7 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 active:scale-90 flex items-center justify-center font-bold text-sm shadow-sm transition-all cursor-pointer"
                                  title="Aumenta serie"
                                >
                                  +
                                </button>
                              </div>

                              {/* Rest Timer Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRestTimerIndex(idx);
                                  setTempRestSeconds(restSec);
                                }}
                                className="h-8 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center gap-1 text-xs font-bold active:scale-95 transition-all shrink-0 cursor-pointer"
                                title="Modifica tempo di riposo per questo esercizio"
                              >
                                <Timer size={12} className="stroke-[2.5px]" />
                                <span>
                                  {Math.floor(restSec / 60)}m {restSec % 60 ? `${restSec % 60}s` : "00s"}
                                </span>
                              </button>

                              {/* Target Reps Input */}
                              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-xl px-2.5 py-1.5 border border-black/5 dark:border-white/10 flex-1 min-w-[95px]">
                                <Target size={12} className="text-emerald-500 shrink-0 stroke-[2.5px]" />
                                <input
                                  type="text"
                                  value={config.targetReps || ""}
                                  onChange={(e) => updateExerciseConfig(idx, { targetReps: e.target.value })}
                                  placeholder="Reps (es. 8-10)"
                                  className="w-full bg-transparent text-xs font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none"
                                  title="Obiettivo ripetizioni o range (es. 8-10, 12, 6-8)"
                                />
                              </div>

                              {/* Target RPE Button */}
                              <button
                                type="button"
                                onClick={() => setEditingRpeIndex(idx)}
                                className={`h-8 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shrink-0 active:scale-95 cursor-pointer ${
                                  config.targetRpe
                                    ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30"
                                    : "bg-black/5 dark:bg-white/5 text-zinc-400 border-black/5 dark:border-white/10 hover:text-purple-500"
                                }`}
                                title="Target RPE programmato (es. @8)"
                              >
                                {config.targetRpe ? `@${config.targetRpe} RPE` : "@RPE"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Catalog Browser */}
                {(() => {
                  const filteredCatalogExercises = allExercises.filter((ex) => {
                    if (!catalogSearchQuery.trim()) return true;
                    const q = catalogSearchQuery.toLowerCase().trim();
                    return (
                      ex.name.toLowerCase().includes(q) ||
                      ex.muscleGroup.toLowerCase().includes(q) ||
                      ex.equipment.toLowerCase().includes(q)
                    );
                  });

                  return (
                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Aggiungi dal Catalogo</label>
                        <button
                          type="button"
                          onClick={() => setIsInnerAddExerciseOpen(true)}
                          className="text-xs font-bold text-primary flex items-center gap-0.5 active:scale-95 transition-transform"
                        >
                          <Plus size={14} /> Nuovo
                        </button>
                      </div>

                      {/* Search Bar */}
                      <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 stroke-[2.5px] pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Cerca esercizio per nome, muscolo o attrezzo..."
                          value={catalogSearchQuery}
                          onChange={(e) => setCatalogSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-8 py-2.5 rounded-xl text-xs font-semibold bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 outline-none focus:border-primary/45 text-foreground placeholder:text-gray-400 transition-all"
                        />
                        {catalogSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setCatalogSearchQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-foreground active:scale-90 transition-all"
                            title="Cancella ricerca"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      
                      {filteredCatalogExercises.length === 0 ? (
                        <div className="text-center p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-black/10 dark:border-white/5 text-xs text-gray-400 font-semibold leading-relaxed flex flex-col items-center justify-center gap-2">
                          <span>
                            {catalogSearchQuery.trim()
                              ? `Nessun esercizio trovato per "${catalogSearchQuery.trim()}"`
                              : "Nessun esercizio nel catalogo."}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (catalogSearchQuery.trim()) {
                                setInnerName(catalogSearchQuery.trim());
                              }
                              setIsInnerAddExerciseOpen(true);
                            }}
                            className="bg-primary/10 border border-primary/20 text-primary font-bold text-xs py-2 px-3.5 rounded-xl active:scale-95 transition-all shadow-sm"
                          >
                            + Crea {catalogSearchQuery.trim() ? `"${catalogSearchQuery.trim()}"` : "Esercizio"} Ora
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                          {filteredCatalogExercises.map((ex) => {
                            const isSelected = selectedExercises.some((e) => e.exerciseId === ex.id);
                            return (
                              <div
                                key={ex.id}
                                onClick={() => toggleSelectExercise(ex.id)}
                                className={`p-3 rounded-xl border transition-all cursor-pointer flex justify-between items-center text-sm font-semibold ${
                                  isSelected
                                    ? "bg-primary/10 border-primary/30 text-primary"
                                    : "bg-white dark:bg-zinc-900 border-black/5 dark:border-white/5 text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                                }`}
                              >
                                <div>
                                  <div className="text-[14px]">{ex.name}</div>
                                  <span className="text-[9px] text-gray-400 uppercase tracking-wider">{ex.muscleGroup} • {ex.equipment}</span>
                                </div>
                                {isSelected ? (
                                  <Check size={16} className="stroke-[3px] text-primary" />
                                ) : (
                                  <Plus size={16} className="text-gray-400 hover:text-primary" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <button
              type="submit"
              disabled={selectedExercises.length === 0}
              className="w-full py-4 bg-primary hover:bg-primary/95 text-white font-bold text-base rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none shrink-0"
            >
              Salva Routine
            </button>
          </form>
        </div>
      )}

      {/* Routine Rest Timer Picker Modal */}
      {editingRestTimerIndex !== null && selectedExercises[editingRestTimerIndex] && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm glass-panel rounded-3xl p-6 shadow-2xl border border-white/20 dark:border-white/10 flex flex-col space-y-4 animate-in zoom-in-95 bg-white dark:bg-zinc-900">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                  <Timer size={12} /> Timer di Riposo Routine
                </span>
                <h3 className="text-base font-black text-foreground mt-0.5 line-clamp-1">
                  {allExercises.find(e => e.id === selectedExercises[editingRestTimerIndex]?.exerciseId)?.name || "Esercizio"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRestTimerIndex(null)}
                className="p-1 rounded-full text-gray-400 hover:text-foreground active:scale-90"
              >
                <X size={20} />
              </button>
            </div>

            {/* Stepper Display */}
            <div className="flex items-center justify-center gap-4 py-3 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setTempRestSeconds((prev) => Math.max(15, prev - 15))}
                className="w-11 h-11 rounded-full bg-white dark:bg-zinc-800 shadow-md flex items-center justify-center text-sm font-black active:scale-90 transition-transform text-foreground cursor-pointer"
              >
                -15s
              </button>
              <div className="text-center min-w-[100px]">
                <div className="text-3xl font-black font-mono text-primary">
                  {Math.floor(tempRestSeconds / 60)}:{(tempRestSeconds % 60).toString().padStart(2, "0")}
                </div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                  {tempRestSeconds} secondi
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTempRestSeconds((prev) => prev + 15)}
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
                    onClick={() => setTempRestSeconds(sec)}
                    className={`py-2 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer ${
                      tempRestSeconds === sec
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
                onClick={() => setEditingRestTimerIndex(null)}
                className="flex-1 py-3 rounded-2xl border border-black/10 dark:border-white/10 text-xs font-bold text-gray-500 hover:text-foreground active:scale-95 transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingRestTimerIndex !== null) {
                    updateExerciseConfig(editingRestTimerIndex, { restSeconds: tempRestSeconds });
                  }
                  setEditingRestTimerIndex(null);
                }}
                className="flex-1 py-3 rounded-2xl bg-primary text-white text-xs font-black shadow-lg shadow-primary/25 active:scale-95 transition-all cursor-pointer"
              >
                Salva Timer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Routine Target RPE Picker Modal */}
      {editingRpeIndex !== null && selectedExercises[editingRpeIndex] && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-t-[32px] p-6 flex flex-col gap-4 ios-modal-animate bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl border-t border-black/5 dark:border-white/10 shadow-2xl pb-safe">
            <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto -mt-2 mb-1" />
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">Target RPE Programmato</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {allExercises.find(e => e.id === selectedExercises[editingRpeIndex]?.exerciseId)?.name || "Esercizio"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRpeIndex(null)}
                className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 active:scale-95 transition-all text-zinc-500 dark:text-zinc-400 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2.5 py-2">
              <button
                type="button"
                onClick={() => {
                  updateExerciseConfig(editingRpeIndex, { targetRpe: undefined });
                  setEditingRpeIndex(null);
                }}
                className={`py-3 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                  selectedExercises[editingRpeIndex]?.targetRpe === undefined
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/10 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                Nessuno
              </button>
              {[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    updateExerciseConfig(editingRpeIndex, { targetRpe: val });
                    setEditingRpeIndex(null);
                  }}
                  className={`py-3 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                    selectedExercises[editingRpeIndex]?.targetRpe === val
                      ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                      : "bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/10 text-zinc-700 dark:text-zinc-200 hover:bg-purple-500/10 hover:text-purple-600"
                  }`}
                >
                  @{val}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 100% Fullscreen Native Modal for Creating/Editing Folder (iOS Style) */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-[125] bg-[#f5f6fa] dark:bg-zinc-950 flex flex-col p-5 ios-modal-animate pb-safe overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b border-black/5 dark:border-white/5 mb-4">
            <h2 className="text-xl font-bold font-sans text-foreground">
              {editingFolder ? "Rinomina Cartella" : (folderParentId ? "Nuova Sottocartella" : "Crea Nuova Cartella")}
            </h2>
            <button 
              type="button"
              onClick={() => {
                setIsFolderModalOpen(false);
                setBottomBarVisible(true);
              }}
              className="p-2 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 active:scale-95 transition-all text-foreground"
              aria-label="Chiudi"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSaveFolder} className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 pb-4">
              <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4 border border-black/5 dark:border-white/5 bg-white dark:bg-zinc-900 shadow-sm">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome Cartella / Settimana</label>
                  <input
                    type="text"
                    placeholder={folderParentId ? "Es. Settimana 1, Blocco A..." : "Es. Scheda Cata 20, Nuova Programmazione..."}
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    className="glass-input w-full px-4 py-3.5 rounded-xl text-base outline-none font-medium text-foreground bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary/45"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cartella Principale (Opzionale)</label>
                  <select
                    value={folderParentId}
                    onChange={(e) => setFolderParentId(e.target.value)}
                    className="glass-input w-full px-4 py-3.5 rounded-xl text-base outline-none font-semibold text-foreground bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary/45"
                  >
                    <option value="">Nessuna (Crea come Cartella Principale)</option>
                    {rootFolders
                      .filter(f => !editingFolder || f.id !== editingFolder.id)
                      .map(f => (
                        <option key={f.id} value={f.id}>
                          📁 {f.name}
                        </option>
                      ))}
                  </select>
                  <span className="text-[10px] text-gray-400">
                    Seleziona una cartella genitore per organizzare questa come sottocartella (es. per le settimane della progressione).
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-primary hover:bg-primary/95 text-white font-bold text-base rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all duration-200 mt-2"
            >
              {editingFolder ? "Salva Modifica" : (folderParentId ? "Crea Sottocartella" : "Crea Cartella")}
            </button>
          </form>
        </div>
      )}

      {/* Nested Fullscreen Native Modal for Creating Exercise Inline inside Routine Editor */}
      {isInnerAddExerciseOpen && (
        <div className="fixed inset-0 z-[130] bg-[#f5f6fa] flex flex-col p-5 ios-modal-animate pb-safe overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b border-black/5 mb-4">
            <h2 className="text-xl font-bold font-sans">Crea Nuovo Esercizio</h2>
            <button 
              onClick={() => setIsInnerAddExerciseOpen(false)}
              className="p-2 rounded-full bg-black/5 hover:bg-black/10 active:scale-95 transition-all"
              aria-label="Chiudi"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleCreateInnerExercise} className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 pb-4">
            <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4 border border-black/5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome Esercizio</label>
                <input
                  type="text"
                  placeholder="Es. Curl concentrato, Affondi..."
                  value={innerName}
                  onChange={(e) => setInnerName(e.target.value)}
                  className="glass-input w-full px-4 py-3.5 rounded-xl text-base outline-none font-medium"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gruppo Muscolare</label>
                <select
                  value={innerMuscleGroup}
                  onChange={(e) => setInnerMuscleGroup(e.target.value)}
                  className="glass-input w-full px-4 py-3.5 rounded-xl text-base outline-none appearance-none font-semibold bg-white"
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

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Attrezzatura</label>
                <select
                  value={innerEquipment}
                  onChange={(e) => setInnerEquipment(e.target.value)}
                  className="glass-input w-full px-4 py-3.5 rounded-xl text-base outline-none appearance-none font-semibold bg-white"
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

              {/* Dynamic Barbell Sub-options (Inner) */}
              {innerEquipment === "Bilanciere" && (
                <div className="flex flex-col gap-3 p-3.5 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Specifica Bilanciere (Tendina)</label>
                    <select
                      value={innerBarbellPreset}
                      onChange={(e) => setInnerBarbellPreset(e.target.value)}
                      className="glass-input w-full px-4 py-3 rounded-xl text-sm outline-none appearance-none font-semibold bg-white"
                    >
                      <option value="Olimpico (20 kg)">Olimpico (20 kg)</option>
                      <option value="EZ / Sagomato (8 kg)">EZ / Sagomato (8 kg)</option>
                      <option value="Standard (10 kg)">Standard (10 kg)</option>
                      <option value="Trap bar (25 kg)">Trap bar (25 kg)</option>
                      <option value="Personalizzato">Personalizzato (digita sotto)...</option>
                    </select>
                  </div>
                  {innerBarbellPreset === "Personalizzato" && (
                    <div className="flex flex-col gap-1.5 animate-in fade-in duration-200">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Scrivi specifica</label>
                      <input
                        type="text"
                        placeholder="Es. Sagomato, 15 kg, Svizzero..."
                        value={innerCustomBarbellText}
                        onChange={(e) => setInnerCustomBarbellText(e.target.value)}
                        className="glass-input w-full px-4 py-3 rounded-xl text-sm outline-none font-medium"
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
              className="w-full py-3.5 bg-primary hover:bg-primary/95 text-white font-bold text-base rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all duration-200 mt-2"
            >
              Aggiungi al Catalogo & Seleziona
            </button>
          </form>
        </div>
      )}
      </ModalPortal>
    </>
  );
}
