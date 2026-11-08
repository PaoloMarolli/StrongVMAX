"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { Dumbbell, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const error = params.get("error");
      if (error) {
        if (error === "OAuthSignin" || error === "Configuration") {
          setErrorMsg("Configurazione Google OAuth non completata su Vercel. Le chiavi GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET non sono impostate o sono errate.");
        } else if (error === "Callback") {
          setErrorMsg(`Errore nel callback di Google. Assicurati che nelle impostazioni della Google Console sia impostato come Authorized redirect URI: ${window.location.origin}/api/auth/callback/google`);
        } else {
          setErrorMsg(`Errore di login: ${error}`);
        }
      }
    }
  }, []);

  const handleGoogleLogin = async () => {
    // Il provider Google per NextAuth richiede le chiavi .env
    await signIn("google", { callbackUrl: "/" });
  };

  const handleDemoLogin = async () => {
    await signIn("demo", { callbackUrl: "/" });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden">
      {/* Elementi decorativi dietro al form per esaltare il glassmorphism */}
      <div className="absolute top-20 -left-20 w-72 h-72 bg-primary/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
      <div className="absolute top-40 -right-20 w-72 h-72 bg-purple-500/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>

      <div className="glass-panel p-10 rounded-3xl w-full max-w-sm flex flex-col items-center gap-8 relative z-10">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-blue-600 rounded-3xl flex items-center justify-center text-white shadow-[0_0_40px_rgba(0,87,255,0.4)]">
            <Dumbbell size={40} />
          </div>
          <h1 className="text-3xl font-bold font-sans tracking-tight text-center drop-shadow-sm">StrongVMAX</h1>
          <p className="text-gray-600 dark:text-gray-300 text-center text-sm font-medium leading-relaxed">
            Traccia i tuoi allenamenti,<br/>batti i tuoi record,<br/>raggiungi i tuoi obiettivi.
          </p>
        </div>

        {errorMsg && (
          <div className="w-full p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 flex items-start gap-3 text-xs leading-relaxed">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Configurazione Google mancante:</span><br/>
              <span className="opacity-90">{errorMsg}</span>
            </div>
          </div>
        )}

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={handleGoogleLogin}
            className="glass-button w-full text-foreground font-semibold py-4 rounded-2xl flex items-center justify-center gap-3"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              <path d="M1 1h22v22H1z" fill="none"/>
            </svg>
            Accedi con Google
          </button>

          <button
            onClick={handleDemoLogin}
            className="glass-button w-full text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-3 bg-primary/70 hover:bg-primary/80 border-primary/30 dark:border-primary/20 shadow-md shadow-primary/25 active:scale-95 transition-all duration-200"
          >
            Entra come Ospite (Demo)
          </button>
        </div>
      </div>
    </div>
  );
}
