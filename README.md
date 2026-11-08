# StrongVMAX

**Tracker di allenamenti in palestra pensato per iPhone, installabile come app dalla schermata Home (PWA).**
Interfaccia in italiano, ispirata all'app *Strong*, con integrazione diretta con le schede di allenamento su Google Fogli.

🔗 **App:** https://strong-vmax.vercel.app

![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel)

---

## Indice

- [Funzionalità](#funzionalità)
- [Struttura del progetto](#struttura-del-progetto)
- [Deploy su Vercel](#deploy-su-vercel)
- [Installazione su iPhone](#installazione-su-iphone)

---

## Funzionalità

L'app ha tre schede principali, navigabili con la tab bar in basso o con uno swipe orizzontale.

### 🏋️ Routine
- Creazione e modifica di **template di allenamento** (routine).
- Organizzazione in **cartelle e sottocartelle** (es. `Programma → S1, S2, … S6`).
- **Duplicazione e spostamento** di singole routine o di intere sottocartelle/settimane verso cartelle esistenti o nuove.
- Per ogni esercizio della routine: numero di serie, **ripetizioni target**, **RPE target** e **tempo di recupero personalizzato**.
- Riordino degli esercizi tramite drag & drop.
- Avvio rapido di un **Workout libero** senza template.

### ⏱️ Allenamento attivo
- Schermata a tutto schermo, **minimizzabile** con un gesto verso il basso (resta una barra flottante).
- Timer dell'allenamento sempre attivo, anche cambiando scheda.
- Tabella serie con **kg**, **reps** (o durata), **RPE** e spunta ✓; colonna con i valori della sessione precedente.
- Tipi di serie: **Normale**, **W** (riscaldamento, esclusa dal volume), **D** (dropset), **F** (cedimento).
- **Timer di recupero** automatico alla spunta, regolabile al volo (+/−), con barra di avanzamento.
- Tastierino numerico personalizzato con stepper, eliminazione serie con swipe.
- Riordino ed eliminazione degli esercizi, aggiunta dal catalogo o creazione al volo.
- Campo **Sensazioni / Feedback** per ogni esercizio.
- Selettore rapido della **settimana** (`S1…S6`) per il collegamento con la scheda su Google Fogli.
- Menu `•••` con scorciatoie a **Spotify**, **Google Fogli** e **Timer iPhone**.
- Al termine: riepilogo (durata + volume) e sincronizzazione automatica con Google Fogli (se collegato).

### 📊 Storico
- Elenco delle sessioni con data, durata, volume ed esercizi.
- Riepilogo settimanale e **calendario mensile** degli allenamenti (navigabile con swipe).
- Modifica di una sessione passata e **ri-sincronizzazione** con Google Fogli.
- Storico per singolo esercizio.
- Profilo: collegamento account Google, tema chiaro/scuro, **backup e ripristino dei dati** (export/import JSON).

### 📚 Esercizi
- Catalogo personale degli esercizi, filtrabile per **gruppo muscolare** e **attrezzatura**.
- Supporto a diversi tipi di bilanciere (olimpico 20 kg, EZ, personalizzato, …).

### Calcolo del volume

```
volume_serie    = kg × reps          (le serie di riscaldamento "W" valgono 0)
volume_sessione = somma dei volumi delle serie completate
```

---

## Struttura del progetto

```
StrongVMAX/
├── README.md
└── webapp/                         ← applicazione Next.js (Root Directory su Vercel)
    ├── public/
    │   ├── manifest.json           ← configurazione PWA (nome, icone, colori)
    │   ├── icon.png                ← icona PWA 512×512
    │   ├── icon-192.png            ← icona PWA 192×192
    │   ├── apple-touch-icon.png    ← icona schermata Home iOS 180×180
    │   └── StrongVMAX Timer.shortcut  ← Comando Rapido iOS per il timer nativo
    └── src/
        ├── app/
        │   ├── layout.tsx          ← struttura comune a tutte le pagine
        │   ├── page.tsx            ← scheda Routine
        │   ├── history/page.tsx    ← scheda Storico
        │   ├── exercises/page.tsx  ← scheda Esercizi
        │   ├── login/page.tsx      ← accesso con Google / ospite
        │   └── api/
        │       ├── auth/[...nextauth]/route.ts  ← login Google
        │       └── sheets/sync/route.ts         ← sincronizzazione Google Fogli
        ├── components/
        │   ├── MainTabSwiper.tsx   ← navigazione a swipe tra le tre schede
        │   ├── BottomTabBar.tsx    ← tab bar in basso
        │   ├── views/              ← RoutineView, HistoryView, ExercisesView
        │   └── workout/ActiveWorkout.tsx  ← schermata di allenamento attivo
        ├── context/
        │   ├── WorkoutContext.tsx  ← stato globale dell'allenamento in corso
        │   └── ThemeContext.tsx    ← tema chiaro/scuro
        ├── lib/auth.ts             ← configurazione NextAuth (Google + refresh token)
        └── utils/storage.ts        ← lettura/scrittura dei dati nel localStorage
```

---

## Deploy su Vercel

1. Importa il repository su Vercel.
2. In **Settings → General → Root Directory** imposta `webapp`.
3. Configura le variabili d'ambiente per Google OAuth e NextAuth nelle impostazioni del progetto Vercel.
4. Su **Google Cloud Console → Credenziali → Client OAuth** aggiungi come *Authorized redirect URI*:
   `https://strong-vmax.vercel.app/api/auth/callback/google`

Da quel momento ogni `git push` su `main` pubblica automaticamente una nuova versione.

---

## Installazione su iPhone

1. Apri `https://strong-vmax.vercel.app` in **Safari**.
2. Tocca **Condividi** → **Aggiungi alla schermata Home**.
3. Apri StrongVMAX direttamente dall'icona sulla schermata Home.
