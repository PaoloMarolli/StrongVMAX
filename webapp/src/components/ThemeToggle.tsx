"use client";

import React from "react";
import { Sun, Moon, Laptop } from "lucide-react";
import { useTheme, ThemeMode } from "@/context/ThemeContext";

export default function ThemeToggle() {
  const { themeMode, setThemeMode } = useTheme();

  const options: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: "light", label: "Chiaro", icon: <Sun size={14} /> },
    { mode: "dark", label: "Scuro", icon: <Moon size={14} /> },
    { mode: "auto", label: "Sistema", icon: <Laptop size={14} /> },
  ];

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        Aspetto Interfaccia (Modalità Apple)
      </label>
      <div className="grid grid-cols-3 p-1 rounded-2xl bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 gap-1 backdrop-blur-md">
        {options.map((opt) => {
          const isActive = themeMode === opt.mode;
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setThemeMode(opt.mode)}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
                isActive
                  ? "bg-white dark:bg-zinc-800 text-primary dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                  : "text-gray-500 dark:text-gray-400 hover:text-foreground"
              }`}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
