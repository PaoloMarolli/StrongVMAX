"use client";

import { useWorkout } from "@/context/WorkoutContext";
import { ChevronDown, Check, Play, Pause, FastForward } from "lucide-react";

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function ActiveWorkout() {
  const { isActive, durationSeconds, totalVolume, finishWorkout, cancelWorkout } = useWorkout();

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-background z-[100] flex flex-col animate-in slide-in-from-bottom-full duration-300">
      {/* Header */}
      <header className="flex justify-between items-center p-4 border-b border-border bg-card">
        <button onClick={cancelWorkout} className="text-gray-500 font-medium active:scale-95 transition-transform">
          Annulla
        </button>
        <div className="flex flex-col items-center">
          <span className="text-secondary font-mono text-lg font-bold">{formatTime(durationSeconds)}</span>
          <span className="text-primary text-xs font-semibold">{totalVolume} kg</span>
        </div>
        <button onClick={finishWorkout} className="text-[#0057FF] dark:text-[#3388ff] font-bold active:scale-95 transition-transform">
          Fine
        </button>
      </header>

      {/* Area scrollabile degli esercizi */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Placeholder Card Esercizio */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h2 className="text-lg font-bold text-primary cursor-pointer active:opacity-70">Panca piana</h2>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-gray-500">Volume: <span className="font-semibold text-primary">0 kg</span></span>
              <span className="text-secondary bg-secondary/10 px-1.5 py-0.5 rounded font-medium">+5% vs prec.</span>
            </div>
          </div>
          
          <div className="px-4 py-2 bg-gray-50 dark:bg-[#151515]">
            <table className="w-full text-sm text-center">
              <thead>
                <tr className="text-gray-500">
                  <th className="font-medium pb-2 w-12">#</th>
                  <th className="font-medium pb-2">prec.</th>
                  <th className="font-medium pb-2">kg</th>
                  <th className="font-medium pb-2">reps</th>
                  <th className="font-medium pb-2 w-10">✓</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border/50">
                  <td className="py-3">
                    <span className="bg-gray-200 dark:bg-gray-800 rounded px-2 py-1 text-xs font-mono">1</span>
                  </td>
                  <td className="py-3 text-gray-400">80×8</td>
                  <td className="py-3">
                    <input type="number" defaultValue={80} className="w-16 text-center bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-primary font-bold" />
                  </td>
                  <td className="py-3">
                    <input type="number" defaultValue={8} className="w-12 text-center bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-primary font-bold" />
                  </td>
                  <td className="py-3">
                    <button className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center mx-auto text-gray-400 active:bg-secondary active:text-white transition-colors">
                      <Check size={16} />
                    </button>
                  </td>
                </tr>
                <tr className="border-t border-border/50 bg-secondary/5 dark:bg-secondary/10">
                  <td className="py-3">
                    <span className="bg-secondary text-white rounded px-2 py-1 text-xs font-mono">2</span>
                  </td>
                  <td className="py-3 text-gray-400">80×8</td>
                  <td className="py-3">
                    <input type="number" defaultValue={80} className="w-16 text-center bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-primary font-bold" />
                  </td>
                  <td className="py-3">
                    <input type="number" defaultValue={8} className="w-12 text-center bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-primary font-bold" />
                  </td>
                  <td className="py-3">
                    <button className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center mx-auto text-white active:bg-gray-200 transition-colors shadow-sm shadow-secondary/50">
                      <Check size={16} />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <button className="w-full mt-2 py-2 text-primary font-medium text-sm flex items-center justify-center gap-1">
              <Plus size={16} /> Aggiungi serie
            </button>
          </div>
        </div>

      </div>

      {/* Rest Timer Bar (Placeholder) */}
      <div className="p-4 bg-card border-t border-border flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-secondary flex items-center justify-center text-secondary">
            <Pause size={18} fill="currentColor" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 font-medium">Riposo</span>
            <span className="font-mono font-bold text-lg leading-none">01:28</span>
          </div>
        </div>
        <button className="flex items-center gap-1 text-sm font-medium text-gray-500 bg-gray-100 dark:bg-[#222] px-3 py-1.5 rounded-full active:scale-95">
          Salta <FastForward size={14} />
        </button>
      </div>
    </div>
  );
}
