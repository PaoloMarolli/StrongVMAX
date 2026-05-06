import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomTabBar from "@/components/BottomTabBar";
import { WorkoutProvider } from "@/context/WorkoutContext";
import ActiveWorkout from "@/components/workout/ActiveWorkout";

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
  themeColor: "#0057FF",
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
      <body className="antialiased pb-16">
        <WorkoutProvider>
          <main className="min-h-screen">
            {children}
          </main>
          <BottomTabBar />
          <ActiveWorkout />
        </WorkoutProvider>
      </body>
    </html>
  );
}
