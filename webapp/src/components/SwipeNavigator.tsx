"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWorkout } from "@/context/WorkoutContext";

export default function SwipeNavigator() {
  const router = useRouter();
  const pathname = usePathname();
  const { isBottomBarVisible, isActive, isMinimized } = useWorkout();
  
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Don't trigger if more than one finger is touching
      if (e.touches.length !== 1) return;
      
      // Don't trigger if a modal or workout is active and not minimized
      if (!isBottomBarVisible || (isActive && !isMinimized)) return;

      touchStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      
      if (!isBottomBarVisible || (isActive && !isMinimized)) {
        touchStart.current = null;
        return;
      }

      const diffX = e.changedTouches[0].clientX - touchStart.current.x;
      const diffY = e.changedTouches[0].clientY - touchStart.current.y;
      
      touchStart.current = null;

      // Swipe thresholds: horizontal displacement must be at least 70px, and vertical tilt must be low (< 45px)
      if (Math.abs(diffX) > 70 && Math.abs(diffY) < 45) {
        const pages = ["/", "/history", "/exercises"];
        const currentIndex = pages.indexOf(pathname);
        
        if (currentIndex !== -1) {
          if (diffX > 70) {
            // Swipe right -> move left (previous page)
            if (currentIndex > 0) {
               router.push(pages[currentIndex - 1]);
            }
          } else if (diffX < -70) {
            // Swipe left -> move right (next page)
            if (currentIndex < pages.length - 1) {
              router.push(pages[currentIndex + 1]);
            }
          }
        }
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pathname, isBottomBarVisible, isActive, isMinimized, router]);

  return null;
}
