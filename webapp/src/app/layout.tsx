import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomTabBar from "@/components/BottomTabBar";
import { WorkoutProvider } from "@/context/WorkoutContext";
import ActiveWorkout from "@/components/workout/ActiveWorkout";
import SwipeNavigator from "@/components/SwipeNavigator";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "StrongVMAX",
  description: "App per il tracking degli allenamenti in palestra",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "StrongVMAX",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">
        <AuthProvider>
          <WorkoutProvider>
            <main className="min-h-screen pb-20">
              {children}
            </main>
            <BottomTabBar />
            <ActiveWorkout />
            <SwipeNavigator />
          </WorkoutProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
