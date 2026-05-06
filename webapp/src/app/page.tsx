"use client";

import { Plus, Play } from "lucide-react";
import { useWorkout } from "@/context/WorkoutContext";

export default function RoutinePage() {
  const { startWorkout } = useWorkout();

  return (
    <div className="flex flex-col h-full w-full">
      <header className="flex justify-between items-center p-4 border-b border-border bg-card sticky top-0 z-10">
        <h1 className="text-2xl font-bold">Routine</h1>
        <button className="p-2 text-primary" aria-label="Nuovo template">
          <Plus size={24} />
        </button>
      </header>
      
      <div className="p-4 flex-1 overflow-y-auto">
        <button 
          onClick={startWorkout}
          className="w-full bg-primary text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 mb-6 shadow-md active:scale-95 transition-transform"
        >
          <Play size={20} fill="currentColor" />
          Workout libero
        </button>
        
        <div className="space-y-4">
          {/* Placeholder for templates */}
          <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
            <div className="flex justify-between items-start mb-1">
              <h2 className="text-xl font-semibold">Push Day</h2>
              <span className="text-xs text-secondary font-medium">6 Esercizi</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
              Panca piana, Panca inclinata, Croci cavi, Shoulder press, Alzate laterali, Tricep pushdown
            </p>
            <div className="flex gap-2">
              <button className="flex-1 bg-gray-100 dark:bg-[#333333] text-foreground font-medium py-2 rounded-lg active:scale-95 transition-transform">
                Modifica
              </button>
              <button onClick={startWorkout} className="flex-1 bg-secondary text-white font-medium py-2 rounded-lg active:scale-95 transition-transform">
                Inizia
              </button>
            </div>
          </div>
          
          <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
            <div className="flex justify-between items-start mb-1">
              <h2 className="text-xl font-semibold">Pull Day</h2>
              <span className="text-xs text-secondary font-medium">5 Esercizi</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
              Trazioni, Rematore bilanciere, Lat machine, Curl bilanciere, Face pulls
            </p>
            <div className="flex gap-2">
              <button className="flex-1 bg-gray-100 dark:bg-[#333333] text-foreground font-medium py-2 rounded-lg active:scale-95 transition-transform">
                Modifica
              </button>
              <button onClick={startWorkout} className="flex-1 bg-secondary text-white font-medium py-2 rounded-lg active:scale-95 transition-transform">
                Inizia
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
