"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, History, Dumbbell } from "lucide-react";
import { useWorkout } from "@/context/WorkoutContext";
import clsx from "clsx";

export default function BottomTabBar() {
  const pathname = usePathname();
  const { isBottomBarVisible } = useWorkout();

  if (!isBottomBarVisible) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 glass-nav flex justify-around items-center z-50 px-4 pb-safe">
      <Link href="/" className={clsx("flex flex-col items-center justify-center w-full h-full", pathname === "/" ? "text-primary" : "text-gray-500 dark:text-gray-400")}>
        <ClipboardList size={24} />
        <span className="text-xs mt-1 font-medium">Routine</span>
      </Link>
      <Link href="/history" className={clsx("flex flex-col items-center justify-center w-full h-full", pathname === "/history" ? "text-primary" : "text-gray-500 dark:text-gray-400")}>
        <History size={24} />
        <span className="text-xs mt-1 font-medium">Storico</span>
      </Link>
      <Link href="/exercises" className={clsx("flex flex-col items-center justify-center w-full h-full", pathname === "/exercises" ? "text-primary" : "text-gray-500 dark:text-gray-400")}>
        <Dumbbell size={24} />
        <span className="text-xs mt-1 font-medium">Esercizi</span>
      </Link>
    </nav>
  );
}
