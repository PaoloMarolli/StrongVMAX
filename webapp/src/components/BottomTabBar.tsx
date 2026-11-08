"use client";

import { usePathname } from "next/navigation";
import { ClipboardList, History, Dumbbell } from "lucide-react";
import { useWorkout } from "@/context/WorkoutContext";
import clsx from "clsx";

export default function BottomTabBar() {
  const pathname = usePathname();
  const { isBottomBarVisible, activeTabIndex, switchTab } = useWorkout();

  if (!isBottomBarVisible || pathname === "/login") return null;

  const tabs = [
    { label: "Routine", path: "/", icon: ClipboardList, index: 0 },
    { label: "Storico", path: "/history", icon: History, index: 1 },
    { label: "Esercizi", path: "/exercises", icon: Dumbbell, index: 2 },
  ];

  const handleTabClick = (index: number, path: string) => {
    switchTab(index);
    if (typeof window !== "undefined" && window.location.pathname !== path) {
      window.history.replaceState(null, "", path);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 glass-nav flex justify-around items-center z-50 px-4 pb-safe select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTabIndex === tab.index;
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => handleTabClick(tab.index, tab.path)}
            className={clsx(
              "flex flex-col items-center justify-center w-full h-full transition-colors active:scale-95 cursor-pointer",
              isActive ? "text-primary" : "text-gray-500 dark:text-gray-400"
            )}
            aria-label={tab.label}
          >
            <Icon size={24} className={isActive ? "stroke-[2.5px]" : "stroke-[2px]"} />
            <span className={clsx("text-xs mt-1", isActive ? "font-bold" : "font-medium")}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
