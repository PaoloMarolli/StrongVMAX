"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export default function ThemeQuickToggle() {
  const { effectiveTheme, themeMode, setThemeMode } = useTheme();

  const toggleTheme = () => {
    if (themeMode === "light") {
      setThemeMode("dark");
    } else if (themeMode === "dark") {
      setThemeMode("light");
    } else {
      setThemeMode(effectiveTheme === "dark" ? "light" : "dark");
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-foreground active:scale-95 transition-all"
      title={`Cambia Aspetto (Apple Style): ${themeMode === "auto" ? `Sistema (${effectiveTheme === "dark" ? "Scuro" : "Chiaro"})` : themeMode === "dark" ? "Scuro" : "Chiaro"}`}
      aria-label="Cambia Tema Chiaro / Scuro"
    >
      {effectiveTheme === "dark" ? (
        <Moon size={18} className="text-blue-400 fill-blue-400/20" />
      ) : (
        <Sun size={18} className="text-amber-500 fill-amber-500/20" />
      )}
    </button>
  );
}
