"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { useWorkout } from "@/context/WorkoutContext";
import RoutineView from "@/components/views/RoutineView";
import HistoryView from "@/components/views/HistoryView";
import ExercisesView from "@/components/views/ExercisesView";

const PATHS = ["/", "/history", "/exercises"];

export default function MainTabSwiper({ initialTab = 0 }: { initialTab?: number }) {
  const { 
    activeTabIndex, 
    setActiveTabIndex, 
    requestedTabIndex,
    isBottomBarVisible, 
    isActive, 
    isMinimized 
  } = useWorkout();

  const containerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef(activeTabIndex);
  const isProgrammaticScroll = useRef(false);
  const programmaticScrollTimer = useRef<NodeJS.Timeout | null>(null);

  activeTabRef.current = activeTabIndex;

  // Position container at initialTab on mount with zero animation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth || 390;
    container.scrollLeft = initialTab * width;

    if (activeTabRef.current !== initialTab) {
      setActiveTabIndex(initialTab);
    }
  }, [initialTab, setActiveTabIndex]);

  // ONLY execute programmatic smooth scrollTo when requestedTabIndex is explicitly set (e.g. BottomTabBar tap)
  useEffect(() => {
    if (requestedTabIndex === null) return;
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth || 390;
    const targetScrollLeft = requestedTabIndex * width;

    if (Math.abs(container.scrollLeft - targetScrollLeft) > 10) {
      isProgrammaticScroll.current = true;
      container.scrollTo({
        left: targetScrollLeft,
        behavior: "smooth",
      });

      if (programmaticScrollTimer.current) {
        clearTimeout(programmaticScrollTimer.current);
      }
      programmaticScrollTimer.current = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 400);
    }
  }, [requestedTabIndex]);

  // Handle native swipe scroll to update activeTabIndex and URL without calling scrollTo
  const handleScroll = useCallback(() => {
    if (isProgrammaticScroll.current) return;
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth || 390;
    if (width <= 0) return;

    const scrollLeft = container.scrollLeft;
    const pageIndex = Math.round(scrollLeft / width);

    if (pageIndex >= 0 && pageIndex <= 2 && pageIndex !== activeTabRef.current) {
      activeTabRef.current = pageIndex;
      setActiveTabIndex(pageIndex);

      if (typeof window !== "undefined") {
        const targetPath = PATHS[pageIndex];
        if (window.location.pathname !== targetPath) {
          window.history.replaceState(null, "", targetPath);
        }
      }
    }
  }, [setActiveTabIndex]);

  // Keep scroll aligned on window resize / orientation change
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      if (!container) return;
      const width = container.clientWidth || window.innerWidth || 390;
      container.scrollLeft = activeTabRef.current * width;
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // When a modal or workout is active, lock horizontal swipe completely
  const isLocked = !isBottomBarVisible || (isActive && !isMinimized);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`w-full h-full min-h-screen flex ${
        isLocked 
          ? "overflow-x-hidden overflow-y-auto" 
          : "overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
      } no-scrollbar`}
      style={{
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        touchAction: isLocked ? "pan-y" : "pan-x pan-y",
      }}
    >
      {/* Panel 0: Routine */}
      <div 
        className="w-full min-w-full max-w-full flex-[0_0_100%] h-full min-h-screen snap-start snap-always shrink-0 overflow-y-auto"
      >
        <RoutineView />
      </div>

      {/* Panel 1: Storico */}
      <div 
        className="w-full min-w-full max-w-full flex-[0_0_100%] h-full min-h-screen snap-start snap-always shrink-0 overflow-y-auto"
      >
        <HistoryView />
      </div>

      {/* Panel 2: Esercizi */}
      <div 
        className="w-full min-w-full max-w-full flex-[0_0_100%] h-full min-h-screen snap-start snap-always shrink-0 overflow-y-auto"
      >
        <ExercisesView />
      </div>
    </div>
  );
}
