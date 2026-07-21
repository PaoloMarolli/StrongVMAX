"use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, X, Trash2 } from "lucide-react";
import { useWorkout } from "@/context/WorkoutContext";
import { storage, Exercise } from "@/utils/storage";

import ThemeQuickToggle from "@/components/ThemeQuickToggle";

export default function ExercisesPage() {
  const { setBottomBarVisible, isBottomBarVisible, isActive, isMinimized, pageAnimationClass } = useWorkout();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Custom Exercise Form State
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("Petto");
  const [equipment, setEquipment] = useState("Bilanciere");
  const [barbellPreset, setBarbellPreset] = useState("Olimpico (20 kg)");
  const [customBarbellText, setCustomBarbellText] = useState("");
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  // Load exercises from local storage on mount
  useEffect(() => {
    setExercises(storage.getExercises());
  }, []);

  const openModal = () => {
    setIsModalOpen(true);
    setBottomBarVisible(false); // Hide bottom nav
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExercise(null);
    setBottomBarVisible(true); // Show bottom nav
  };

  const openAddModal = () => {
    setEditingExercise(null);
    setName("");
    setMuscleGroup("Petto");
    setEquipment("Bilanciere");
    setBarbellPreset("Olimpico (20 kg)");
    setCustomBarbellText("");
    openModal();
  };

  const handleEditExerciseClick = (ex: Exercise) => {
    setEditingExercise(ex);
    setName(ex.name);
    setMuscleGroup(ex.muscleGroup);
    
    // Parse equipment and barbell presets
    if (ex.equipment.startsWith("Bilanciere - ")) {
      setEquipment("Bilanciere");
      const sub = ex.equipment.replace("Bilanciere - ", "");
      const presets = ["Olimpico (20 kg)", "EZ / Sagomato (8 kg)", "Standard (10 kg)", "Trap bar (25 kg)"];
      if (presets.includes(sub)) {
        setBarbellPreset(sub);
        setCustomBarbellText("");
      } else {
        setBarbellPreset("Personalizzato");
        setCustomBarbellText(sub);
      }
    } else {
      setEquipment(ex.equipment);
      setBarbellPreset("Olimpico (20 kg)");
      setCustomBarbellText("");
    }
    
    openModal();
  };

  const handleDeleteExercise = (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questo esercizio?")) {
      storage.deleteExercise(id);
      setExercises((prev) => prev.filter(ex => ex.id !== id));
      closeModal();
    }
  };

  const handleAddExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalEquipment = equipment === "Bilanciere"
      ? (barbellPreset === "Personalizzato" ? `Bilanciere - ${customBarbellText || "Olimpico"}` : `Bilanciere - ${barbellPreset}`)
      : equipment;

    if (editingExercise) {
      const updated = storage.updateExercise(editingExercise.id, name, muscleGroup, finalEquipment);
      setExercises((prev) => prev.map(ex => ex.id === updated.id ? updated : ex));
    } else {
      const newEx = storage.addExercise(name, muscleGroup, finalEquipment);
      setExercises((prev) => [...prev, newEx]);
    }
    
    // Reset Form
    setName("");
    setMuscleGroup("Petto");
    setEquipment("Bilanciere");
    setBarbellPreset("Olimpico (20 kg)");
    setCustomBarbellText("");
    closeModal();
  };

  // Filter exercises by search query
  const filteredExercises = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by muscle group
  const groupedExercises = filteredExercises.reduce((acc, exercise) => {
    const group = exercise.muscleGroup || "Altro";
    if (!acc[group]) acc[group] = [];
    acc[group].push(exercise);
    return acc;
  }, {} as Record<string, Exercise[]>);

  // Sort exercises inside each group alphabetically
  Object.keys(groupedExercises).forEach((group) => {
    groupedExercises[group].sort((a, b) => a.name.localeCompare(b.name));
  });

  const isModalActive = !isBottomBarVisible || (isActive && !isMinimized);

  return (
    <>
      <div className={`flex flex-col h-full w-full relative z-0 ${pageAnimationClass} ${isModalActive ? "apple-page-scaled" : ""}`}>
        <header className="glass-header flex flex-col p-4 sticky top-0 z-10 gap-3">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold font-sans tracking-tight">Esercizi</h1>
          <div className="flex items-center gap-1">
            <ThemeQuickToggle />
            <button 
              onClick={openAddModal}
              className="p-2 text-primary active:scale-95 transition-transform" 
              aria-label="Nuovo esercizio"
            >
              <Plus size={24} />
            </button>
          </div>
        </div>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="Cerca esercizio..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input block w-full pl-10 pr-3 py-2.5 rounded-xl text-sm outline-none font-medium"
          />
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto pb-20">
        {Object.entries(groupedExercises).length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh] gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Plus size={32} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Nessun esercizio</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mt-1">
                La lista è vuota. Tocca &ldquo;+&rdquo; in alto a destra per registrare il tuo primo esercizio personalizzato!
              </p>
            </div>
          </div>
        ) : (
          Object.entries(groupedExercises)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([group, groupExercises]) => (
              <div key={group} className="border-b border-black/5 dark:border-white/5">
                <div className="glass-header px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {group}
                </div>
                {groupExercises.map((exercise) => (
                  <div 
                    key={exercise.id} 
                    onClick={() => handleEditExerciseClick(exercise)}
                    className="px-4 py-4 border-b border-black/5 dark:border-white/5 active:bg-white/10 dark:active:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-[15px]">{exercise.name}</h3>
                      {exercise.isCustom && (
                        <span className="text-[9px] bg-primary/15 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Custom</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{exercise.equipment || "Nessun attrezzo"}</p>
                  </div>
                ))}
              </div>
            ))
        )}
      </div>
      </div>

      {/* 100% Fullscreen Native Modal Sheet for adding a custom exercise (iOS Style) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[120] bg-[#f5f6fa] flex flex-col p-5 ios-modal-animate pb-safe overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b border-black/5 mb-4">
            <h2 className="text-xl font-bold font-sans">
              {editingExercise ? "Modifica Esercizio" : "Nuovo Esercizio"}
            </h2>
            <div className="flex items-center gap-2">
              {editingExercise && (
                <button
                  type="button"
                  onClick={() => handleDeleteExercise(editingExercise.id)}
                  className="p-2 rounded-full text-red-500 hover:bg-red-500/10 active:scale-90 transition-all animate-in fade-in"
                  title="Elimina Esercizio"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button 
                onClick={closeModal}
                className="p-2 rounded-full bg-black/5 hover:bg-black/10 active:scale-95 transition-all"
                aria-label="Chiudi"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <form onSubmit={handleAddExercise} className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 pb-4">
            <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4 border border-black/5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome Esercizio</label>
                <input
                  type="text"
                  placeholder="Es. Panca Piana, Squat, Curl..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input w-full px-4 py-3.5 rounded-xl text-base outline-none font-medium"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gruppo Muscolare</label>
                <select
                  value={muscleGroup}
                  onChange={(e) => setMuscleGroup(e.target.value)}
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
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
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

              {/* Dynamic Barbell Sub-options */}
              {equipment === "Bilanciere" && (
                <div className="flex flex-col gap-3 p-3.5 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Specifica Bilanciere (Tendina)</label>
                    <select
                      value={barbellPreset}
                      onChange={(e) => setBarbellPreset(e.target.value)}
                      className="glass-input w-full px-4 py-3 rounded-xl text-sm outline-none appearance-none font-semibold bg-white"
                    >
                      <option value="Olimpico (20 kg)">Olimpico (20 kg)</option>
                      <option value="EZ / Sagomato (8 kg)">EZ / Sagomato (8 kg)</option>
                      <option value="Standard (10 kg)">Standard (10 kg)</option>
                      <option value="Trap bar (25 kg)">Trap bar (25 kg)</option>
                      <option value="Personalizzato">Personalizzato (digita sotto)...</option>
                    </select>
                  </div>
                  {barbellPreset === "Personalizzato" && (
                    <div className="flex flex-col gap-1.5 animate-in fade-in duration-200">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Scrivi specifica</label>
                      <input
                        type="text"
                        placeholder="Es. Sagomato, 15 kg, Svizzero..."
                        value={customBarbellText}
                        onChange={(e) => setCustomBarbellText(e.target.value)}
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
              {editingExercise ? "Salva Modifiche" : "Crea Esercizio"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
