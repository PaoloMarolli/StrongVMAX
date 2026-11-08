import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomTabBar from "@/components/BottomTabBar";
import { WorkoutProvider } from "@/context/WorkoutContext";
import { ThemeProvider } from "@/context/ThemeContext";
import ActiveWorkout from "@/components/workout/ActiveWorkout";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "StrongVMAX",
  description: "App per il tracking degli allenamenti in palestra",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/apple-touch-icon.png",
  },
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
          <ThemeProvider>
            <WorkoutProvider>
              <main className="min-h-screen w-full overflow-x-hidden">
                {children}
              </main>
              <BottomTabBar />
              <ActiveWorkout />
            </WorkoutProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
