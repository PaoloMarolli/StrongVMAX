"use client";

import React, { useState, useEffect } from "react";
import { Plus, Play, Dumbbell, X, Check, Trash2, GripVertical } from "lucide-react";
import { useWorkout } from "@/context/WorkoutContext";
import { storage, WorkoutTemplate, Exercise, WorkoutExercise } from "@/utils/storage";

export default function RoutinePage() {
  const { startWorkout, setBottomBarVisible, isBottomBarVisible, isActive, isMinimized, pageAnimationClass } = useWorkout();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  
  // Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);

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

  // Load templates and exercises from local-first storage
  const loadData = () => {
    setTemplates(storage.getTemplates());
    setAllExercises(storage.getExercises());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartTemplate = (template: WorkoutTemplate) => {
    // Map template exercise IDs to full active workout exercises structure
    const exercises: WorkoutExercise[] = template.exercises.map((id) => {
      const found = allExercises.find((e) => e.id === id);
      return {
        exerciseId: id,
        exerciseName: found ? found.name : "Esercizio",
        sets: [
          { weight: 0, reps: 0, setOrder: 1 },
          { weight: 0, reps: 0, setOrder: 2 },
          { weight: 0, reps: 0, setOrder: 3 },
        ], // pre-populate with 3 empty sets for convenience
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
  const openCreator = () => {
    setEditingTemplate(null);
    setTemplateName("");
    setSelectedExerciseIds([]);
    setIsEditorOpen(true);
    setBottomBarVisible(false);
  };

  // Open Editor Modal
  const openEditor = (template: WorkoutTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setSelectedExerciseIds([...template.exercises]);
    setIsEditorOpen(true);
    setBottomBarVisible(false);
  };

  // Close Editor Modal
  const closeEditor = () => {
    setIsEditorOpen(false);
    setBottomBarVisible(true);
  };



  // Remove Selected Exercise
  const removeExerciseFromSelected = (id: string) => {
    setSelectedExerciseIds((prev) => prev.filter((exId) => exId !== id));
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

    if (targetIndex !== hoveredIndex && targetIndex >= 0 && targetIndex < selectedExerciseIds.length) {
      setHoveredIndex(targetIndex);
    }
  };

  const handleTouchEnd = () => {
    if (draggedIndex !== null && hoveredIndex !== null && draggedIndex !== hoveredIndex) {
      setSelectedExerciseIds((prev) => {
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

    if (editingTemplate) {
      storage.updateTemplate(editingTemplate.id, templateName, selectedExerciseIds);
    } else {
      storage.saveTemplate(templateName, selectedExerciseIds);
    }

    loadData();
    closeEditor();
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
    
    // Automatically check the newly created exercise in the active selection
    setSelectedExerciseIds((prev) => [...prev, newEx.id]);
    
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
      .map((id) => {
        const found = allExercises.find((e) => e.id === id);
        return found ? found.name : null;
      })
      .filter(Boolean)
      .join(", ");
  };

  const isModalActive = !isBottomBarVisible || (isActive && !isMinimized);

  return (
    <>
      <div className={`flex flex-col h-full w-full relative z-0 ${pageAnimationClass} ${isModalActive ? "apple-page-scaled" : ""}`}>
        <header className="glass-header flex justify-between items-center p-4 sticky top-0 z-10">
        <h1 className="text-3xl font-black font-sans tracking-tight">Routine</h1>
        <button 
          onClick={openCreator}
          className="p-2 text-primary active:scale-95 transition-transform" 
          aria-label="Nuovo template"
        >
          <Plus size={24} />
        </button>
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
            <span className="text-[10px] text-primary font-bold">{templates.length} totali</span>
          </div>

          {templates.map((template) => {
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

          {templates.length === 0 && (
            <div className="p-8 text-center text-gray-500 font-medium bg-black/5 dark:bg-white/5 rounded-2xl border border-dashed border-black/10 dark:border-white/10">
              Nessun template personalizzato ancora creato. Tocca &ldquo;+&rdquo; in alto per iniziare a strutturare le tue routine!
            </div>
          )}
        </div>
      </div>
      </div>

      {/* 100% Fullscreen Native Modal Sheet for Routine Detail (iOS Style) */}
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
                  {detailTemplate.exercises.map((id, index) => {
                    const found = allExercises.find((e) => e.id === id);
                    if (!found) return null;
                    return (
                      <div 
                        key={index} 
                        className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between shadow-sm"
                      >
                        <div>
                          <div className="font-semibold text-[15px]">{found.name}</div>
                          <span className="text-[9px] text-gray-400 uppercase tracking-wider">{found.muscleGroup} • {found.equipment}</span>
                        </div>
                        <span className="text-xs bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg font-mono font-bold text-gray-400">
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

                {/* Selected Exercises Reordering & Deletion List */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Esercizi Inclusi (Tieni premuto per ordinare)</label>
                  {selectedExerciseIds.length === 0 ? (
                    <div className="text-center p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-black/10 dark:border-white/5 text-xs text-gray-400 font-semibold leading-relaxed">
                      Nessun esercizio aggiunto. Seleziona gli esercizi dal catalogo sottostante.
                    </div>
                  ) : (
                    <div className="space-y-2 select-none relative">
                      {selectedExerciseIds.map((id, idx) => {
                        const ex = allExercises.find((e) => e.id === id);
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
                            const draggedHeight = itemsRects.current[draggedIndex]?.height || 60;
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

                        return (
                          <div
                            key={`${id}_${idx}`}
                            className={`drag-item select-none flex items-center justify-between border shadow-sm ${
                              isDraggingAny
                                ? isCurrentDragged
                                  ? "p-4 bg-primary/10 border-primary/40 text-primary scale-105 shadow-xl z-30 ring-2 ring-primary/20 cursor-grabbing touch-none"
                                  : "p-2 scale-[0.96] border-black/5 dark:border-white/5 bg-white dark:bg-zinc-900 text-gray-400 opacity-100"
                                : "p-3.5 bg-white dark:bg-zinc-900 border-black/5 dark:border-white/5 text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-default"
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
                            <div className="flex items-center gap-3 flex-1 min-w-0">
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
                                <div className="text-[14px] font-semibold truncate">{ex.name}</div>
                                <span className="text-[9px] text-gray-400 uppercase tracking-wider">{ex.muscleGroup} • {ex.equipment}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center shrink-0">
                              <button
                                type="button"
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={() => removeExerciseFromSelected(ex.id)}
                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-500 active:scale-90 transition-all"
                                title="Rimuovi dalla Routine"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Catalog Browser */}
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
                  
                  {allExercises.length === 0 ? (
                    <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-black/10 dark:border-white/5 text-xs text-gray-400 font-semibold leading-relaxed flex flex-col items-center justify-center gap-3">
                      Nessun esercizio nel catalogo.
                      <button
                        type="button"
                        onClick={() => setIsInnerAddExerciseOpen(true)}
                        className="bg-primary/10 border border-primary/20 text-primary font-bold text-xs py-2.5 px-4 rounded-xl active:scale-95 transition-all shadow-sm"
                      >
                        + Crea Esercizio Ora
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {allExercises.map((ex) => {
                        const isSelected = selectedExerciseIds.includes(ex.id);
                        return (
                          <div
                            key={ex.id}
                            onClick={() => {
                              if (isSelected) {
                                removeExerciseFromSelected(ex.id);
                              } else {
                                setSelectedExerciseIds((prev) => [...prev, ex.id]);
                              }
                            }}
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
              </div>
            </div>

            <button
              type="submit"
              disabled={selectedExerciseIds.length === 0}
              className="w-full py-4 bg-primary hover:bg-primary/95 text-white font-bold text-base rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none shrink-0"
            >
              Salva Routine
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
    </>
  );
}
