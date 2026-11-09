# StrongVMAX

**Gym workout tracker designed for iPhone, installable as a Home Screen app (PWA).**
Inspired by the *Strong* workout app, featuring direct integration with training programs on Google Sheets.

🔗 **Live App:** https://strong-vmax.vercel.app

![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel)

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Deploy on Vercel](#deploy-on-vercel)
- [Install on iPhone](#install-on-iphone)

---

## Features

The app is organized into three main tabs, accessible via the bottom tab bar or horizontal swipe gestures.

### 🏋️ Routines
- Create and edit **workout templates** (routines).
- Organize routines into **folders and subfolders** (e.g. `Program → W1, W2, … W6`).
- **Duplicate and move** individual routines or entire subfolders/weeks into existing or new folders.
- Group two or more exercises into **Supersets / Trisets** (`A1/A2`, `B1/B2`) with color-coded badges and automatic `0s` intra-superset transitions.
- Configure per-exercise sets, **target reps**, **target RPE**, and **custom rest timers**.
- Reorder exercises via drag & drop.
- Quick-start an empty **Free Workout** without a template.

### ⏱️ Active Workout
- Full-screen workout logger, **minimizable** with a swipe-down gesture into a floating bottom bar.
- Persistent workout elapsed timer across tabs.
- Set table with **kg**, **reps** (or duration), **RPE**, completion checkmark ✓, and previous session values.
- Set types: **Normal**, **W** (warm-up, excluded from volume), **D** (dropset), **F** (failure).
- **Superset flow & automatic rest timer**: instant auto-scroll to the next exercise in the superset (`A1 → A2`) or custom rest countdown at the end of the round, adjustable on the fly (+/−) with a progress bar.
- Custom numeric keypad with steppers and swipe-to-delete sets.
- Reorder or remove exercises, add from the catalog, or create new exercises on the fly.
- Per-exercise **Notes / Feedback** field.
- Quick **week selector** (`S1…S6`) for linking sessions to Google Sheets training programs.
- `•••` action menu with quick shortcuts to **Spotify**, **Google Sheets**, and the native **iPhone Timer**.
- Post-workout summary (duration + total volume) and automatic Google Sheets synchronization (when connected).

### 📊 History
- Chronological log of completed workouts with date, duration, total volume, and exercises.
- Weekly activity summary and **monthly workout calendar** (swipeable across months).
- Edit past workout sessions and **re-sync** with Google Sheets.
- Per-exercise performance history.
- Profile settings: Google account connection, light/dark theme toggle, and **JSON data backup & restore** (export/import).

### 📚 Exercises
- Custom exercise catalog filterable by **muscle group** and **equipment**.
- Support for multiple barbell types (Olympic 20 kg, EZ bar, custom weight, etc.).

### Volume Calculation

```
set_volume     = kg × reps          (warm-up "W" sets count as 0)
session_volume = sum of completed set volumes
```

---

## Project Structure

```
StrongVMAX/
├── README.md
└── webapp/                         ← Next.js application (Root Directory on Vercel)
    ├── public/
    │   ├── manifest.json           ← PWA manifest (name, icons, theme colors)
    │   ├── icon.png                ← PWA icon 512×512
    │   ├── icon-192.png            ← PWA icon 192×192
    │   ├── apple-touch-icon.png    ← iOS Home Screen icon 180×180
    │   └── StrongVMAX Timer.shortcut  ← iOS Shortcut for native timer integration
    └── src/
        ├── app/
        │   ├── layout.tsx          ← Root layout shared across all pages
        │   ├── page.tsx            ← Routines tab
        │   ├── history/page.tsx    ← History tab
        │   ├── exercises/page.tsx  ← Exercises tab
        │   ├── login/page.tsx      ← Google sign-in / guest access
        │   └── api/
        │       ├── auth/[...nextauth]/route.ts  ← Google OAuth handler
        │       └── sheets/sync/route.ts         ← Google Sheets sync endpoint
        ├── components/
        │   ├── MainTabSwiper.tsx   ← Horizontal swipe navigation across tabs
        │   ├── BottomTabBar.tsx    ← Bottom navigation bar
        │   ├── views/              ← RoutineView, HistoryView, ExercisesView
        │   └── workout/ActiveWorkout.tsx  ← Active workout screen
        ├── context/
        │   ├── WorkoutContext.tsx  ← Global state for the active workout
        │   └── ThemeContext.tsx    ← Light/dark theme state
        ├── lib/auth.ts             ← NextAuth configuration (Google + token refresh)
        └── utils/storage.ts        ← LocalStorage read/write helpers
```

---

## Deploy on Vercel

1. Import the repository on Vercel.
2. In **Settings → General → Root Directory**, set `webapp`.
3. *(Optional — only required if you want Google Sheets sync)* Configure the Google OAuth and NextAuth environment variables in your Vercel project settings, and add `https://<your-domain>/api/auth/callback/google` as an *Authorized redirect URI* in **Google Cloud Console → Credentials → OAuth 2.0 Client**.

Every `git push` to `main` automatically deploys a new production version.

---

## Install on iPhone

1. Open `https://strong-vmax.vercel.app` in **Safari**.
2. Tap **Share** → **Add to Home Screen**.
3. Launch StrongVMAX directly from your Home Screen icon.
