import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface SyncSet {
  weight: number;
  reps: number;
  rpe?: number;
  type?: string;
}

interface SyncExercise {
  exerciseName: string;
  sets: SyncSet[];
  feedback?: string;
}

interface GoogleSheetBatchUpdate {
  range: string;
  values: string[][];
}

interface GoogleDriveFile {
  id: string;
  name: string;
}

interface GoogleDriveSearchResponse {
  files: GoogleDriveFile[];
}

// Exact positional row ranges for Scheda Cata 21 (identical across S1..S6):
// Day 1 (Giorno A - Squat): rows 8 to 13
// Day 2 (Giorno B - Bench): rows 19 to 24
// Day 3 (Giorno C - Deadlift): rows 30 to 35
// Day 4 (Giorno D - SBD): rows 41 to 45
const DAY_CONFIG = [
  { day: 1, letter: "A", name: "Squat", startRow: 8, endRow: 13 },
  { day: 2, letter: "B", name: "Bench", startRow: 19, endRow: 24 },
  { day: 3, letter: "C", name: "Deadlift", startRow: 30, endRow: 35 },
  { day: 4, letter: "D", name: "SBD", startRow: 41, endRow: 45 },
];

function resolveWeekSheetName(workoutName: string, sheetNames: string[]): string {
  // 1. Explicit week patterns: S1..S6, W1..W6, Settimana 1..6, Sett 1..6, Week 1..6
  const weekPatterns = [
    /\b[sS]\s*([1-6])\b/,
    /\b[wW]\s*([1-6])\b/,
    /\bsett(?:imana)?\.?\s*([1-6])\b/i,
    /\bweek\s*([1-6])\b/i,
  ];

  for (const pattern of weekPatterns) {
    const match = workoutName.match(pattern);
    if (match) {
      const weekNum = match[1];
      const found = sheetNames.find((sheet) => {
        const sl = sheet.toLowerCase().trim();
        return (
          sl === `s${weekNum}` ||
          sl === `w${weekNum}` ||
          sl === `settimana ${weekNum}` ||
          sl === `sett ${weekNum}` ||
          sl === `week ${weekNum}`
        );
      });
      return found || `S${weekNum}`;
    }
  }

  // 2. Direct sheet title containment check (longest first)
  const nameLower = workoutName.toLowerCase();
  const sortedSheets = [...sheetNames].sort((a, b) => b.length - a.length);
  for (const sheet of sortedSheets) {
    if (nameLower.includes(sheet.toLowerCase())) {
      return sheet;
    }
  }

  // 3. Default fallback to S1
  const defaultS1 = sheetNames.find(
    (s) => s.toLowerCase().trim() === "s1" || s.toLowerCase().includes("s1")
  );
  return defaultS1 || sheetNames[0] || "S1";
}

function resolveDayIndex(workoutName: string, bodyDayIndex?: number): number {
  if (
    bodyDayIndex !== undefined &&
    typeof bodyDayIndex === "number" &&
    bodyDayIndex >= 0 &&
    bodyDayIndex <= 3
  ) {
    return bodyDayIndex;
  }

  // Remove week tokens (e.g. S1..S6, W1..W6, Settimana 1..6) so week numbers never interfere with day parsing
  const nameWithoutWeek = workoutName
    .replace(/\b(?:[sSwW]|settimana|sett\.?|week)\s*[1-9]\d*\b/gi, " ")
    .trim();
  const nameLower = nameWithoutWeek.toLowerCase();

  // 1. Explicit "Giorno / Day / Routine / Allenamento / Scheda / Workout" + A/B/C/D or 1/2/3/4
  const explicitDayMatch = nameWithoutWeek.match(
    /\b(?:giorno|day|routine|allenamento|scheda|workout)\s*[-_:\.#]?\s*([a-d1-4])\b/i
  );
  if (explicitDayMatch) {
    const val = explicitDayMatch[1].toLowerCase();
    if (val === "a" || val === "1") return 0;
    if (val === "b" || val === "2") return 1;
    if (val === "c" || val === "3") return 2;
    if (val === "d" || val === "4") return 3;
  }

  // 2. Standalone letter A, B, C, D or number 1, 2, 3, 4 in the remaining workout name
  const standaloneMatch = nameWithoutWeek.match(/\b([a-d1-4])\b/i);
  if (standaloneMatch) {
    const val = standaloneMatch[1].toLowerCase();
    if (val === "a" || val === "1") return 0;
    if (val === "b" || val === "2") return 1;
    if (val === "c" || val === "3") return 2;
    if (val === "d" || val === "4") return 3;
  }

  // 3. Descriptive keywords
  if (
    nameLower.includes("giorno d") ||
    nameLower.includes("giorno 4") ||
    nameLower.includes("sbd") ||
    nameLower.includes("total upper") ||
    nameLower.includes("richiamo") ||
    nameLower.includes("full body") ||
    nameLower.includes("quarta routine")
  ) {
    return 3;
  }
  if (
    nameLower.includes("giorno c") ||
    nameLower.includes("giorno 3") ||
    nameLower.includes("deadlift") ||
    nameLower.includes("stacco") ||
    nameLower.includes("gambe") ||
    nameLower.includes("lower") ||
    nameLower.includes("legs") ||
    nameLower.includes("terza routine")
  ) {
    return 2;
  }
  if (
    nameLower.includes("giorno b") ||
    nameLower.includes("giorno 2") ||
    nameLower.includes("bench") ||
    nameLower.includes("panca") ||
    nameLower.includes("spalle") ||
    nameLower.includes("braccia") ||
    nameLower.includes("seconda routine")
  ) {
    return 1;
  }
  if (
    nameLower.includes("giorno a") ||
    nameLower.includes("giorno 1") ||
    nameLower.includes("squat") ||
    nameLower.includes("petto") ||
    nameLower.includes("dorso") ||
    nameLower.includes("prima routine")
  ) {
    return 0;
  }

  return 0; // Default to Giorno A (Day 1)
}

function formatExerciseKgValue(sets: SyncSet[]): string {
  const adjustedSets = sets.map((s: SyncSet) => ({
    ...s,
    adjustedReps: s.type === "F" ? s.reps - 0.5 : s.reps,
  }));

  if (adjustedSets.length === 0) return "";

  const allIdentical = adjustedSets.every(
    (s) =>
      s.weight === adjustedSets[0].weight &&
      s.adjustedReps === adjustedSets[0].adjustedReps &&
      (s.rpe === undefined ? 0 : parseFloat(s.rpe.toString().replace(",", "."))) ===
        (adjustedSets[0].rpe === undefined
          ? 0
          : parseFloat(adjustedSets[0].rpe.toString().replace(",", ".")))
  );

  if (allIdentical) {
    const ordinals = ["1°", "2°", "3°", "4°", "5°", "6°"]
      .slice(0, adjustedSets.length)
      .join(", ");
    const formattedWeight = adjustedSets[0].weight.toString().replace(".", ",");
    const formattedReps = adjustedSets[0].adjustedReps.toString().replace(".", ",");
    const rpeVal = adjustedSets[0].rpe
      ? parseFloat(adjustedSets[0].rpe.toString().replace(",", "."))
      : 0;
    const rpeSuffix = rpeVal > 0 ? ` @ ${rpeVal.toString().replace(".", ",")}` : "";
    return `${ordinals} set ${formattedWeight} x ${formattedReps}${rpeSuffix}`;
  }

  return adjustedSets
    .map((s, idx: number) => {
      const formattedWeight = s.weight.toString().replace(".", ",");
      const formattedReps = s.adjustedReps.toString().replace(".", ",");
      const rpeVal = s.rpe ? parseFloat(s.rpe.toString().replace(",", ".")) : 0;
      const rpeSuffix = rpeVal > 0 ? ` @ ${rpeVal.toString().replace(".", ",")}` : "";
      return `${idx + 1}° set ${formattedWeight} x ${formattedReps}${rpeSuffix}`;
    })
    .join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const typedSession = session as { accessToken?: string } | null;

    if (!typedSession || !typedSession.accessToken) {
      return NextResponse.json(
        {
          error:
            "Non autorizzato. Effettua l'accesso con il tuo account Google per sincronizzare.",
        },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      workoutName?: string;
      exercises?: SyncExercise[];
      dayIndex?: number;
    };
    const { workoutName, exercises, dayIndex: bodyDayIndex } = body;

    if (!workoutName || !exercises || !Array.isArray(exercises)) {
      return NextResponse.json(
        { error: "Dati della routine mancanti o non validi." },
        { status: 400 }
      );
    }

    const accessToken = typedSession.accessToken;

    // 1. Search for spreadsheet named "Scheda Cata 21" (or latest "Scheda Cata") in Drive
    const searchQueries = [
      "name contains 'Scheda Cata 21' and mimeType='application/vnd.google-apps.spreadsheet' and trashed = false",
      "name contains 'Cata 21' and mimeType='application/vnd.google-apps.spreadsheet' and trashed = false",
      "name contains 'Scheda Cata' and mimeType='application/vnd.google-apps.spreadsheet' and trashed = false",
    ];

    let matchedFile: GoogleDriveFile | null = null;

    for (const q of searchQueries) {
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        q
      )}&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

      const driveRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (driveRes.ok) {
        const driveData = (await driveRes.json()) as GoogleDriveSearchResponse;
        if (driveData.files && driveData.files.length > 0) {
          const with21 = driveData.files.find((f) => f.name.includes("21"));
          matchedFile = with21 || driveData.files[0];
          break;
        }
      }
    }

    if (!matchedFile) {
      return NextResponse.json(
        {
          error:
            "File 'Scheda Cata 21' non trovato su Google Drive. Assicurati che esista un foglio Google con 'Scheda Cata 21' nel titolo.",
        },
        { status: 404 }
      );
    }

    const spreadsheetId = matchedFile.id;
    console.log(`Using target Google Spreadsheet '${matchedFile.name}' (ID: ${spreadsheetId})`);

    // 2. Fetch spreadsheet metadata to get all sheet names and sheet IDs
    const metadataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(title,sheetId)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    let sheetsMeta: { title: string; sheetId: number }[] = [];
    let sheetNames: string[] = [];
    if (metadataRes.ok) {
      const metadata = (await metadataRes.json()) as {
        sheets?: { properties: { title: string; sheetId: number } }[];
      };
      sheetsMeta = (metadata.sheets || []).map((s) => s.properties);
      sheetNames = sheetsMeta.map((s) => s.title);
      console.log("Spreadsheet sheets available:", sheetNames);
    }

    // 3. Resolve Week Sheet Name (S1, S2, S3, S4, S5, S6) and Day Index (0..3 -> Giorno A..D)
    const sheetName = resolveWeekSheetName(workoutName, sheetNames);
    const dayIndex = resolveDayIndex(workoutName, bodyDayIndex);
    const currentConfig = DAY_CONFIG[dayIndex] || DAY_CONFIG[0];

    const matchedSheetMeta = sheetsMeta.find((s) => s.title === sheetName);
    const targetSheetId = matchedSheetMeta ? matchedSheetMeta.sheetId : 0;

    console.log(
      `Parsed workout '${workoutName}' -> Sheet '${sheetName}', Giorno ${currentConfig.letter} (Day ${currentConfig.day} - ${currentConfig.name}): Rows ${currentConfig.startRow} to ${currentConfig.endRow}`
    );

    // 4. Construct positional batch updates for Column D (KG) and Column F (Feedback Atleta)
    const batchUpdates: GoogleSheetBatchUpdate[] = [];
    const updatedRowNumbers: number[] = [];

    exercises.forEach((ex: SyncExercise, exIdx: number) => {
      const rowNumber = currentConfig.startRow + exIdx;
      if (rowNumber > currentConfig.endRow) {
        console.warn(
          `Exercise index ${exIdx} (${ex.exerciseName}) exceeds Giorno ${currentConfig.letter} max row ${currentConfig.endRow}, skipping.`
        );
        return;
      }

      const rawSets = ex.sets || [];
      const sets = rawSets.filter((s: SyncSet) => s.reps > 0 || s.weight > 0);

      if (sets.length > 0 || ex.feedback) {
        updatedRowNumbers.push(rowNumber);
        const kgValue = formatExerciseKgValue(sets);

        // Write Column D (KG)
        batchUpdates.push({
          range: `${sheetName}!D${rowNumber}`,
          values: [[kgValue]],
        });

        // Write Column F (Feedback Atleta)
        batchUpdates.push({
          range: `${sheetName}!F${rowNumber}`,
          values: [[ex.feedback || ""]],
        });

        console.log(
          `Syncing Exercise ${exIdx + 1} (${ex.exerciseName}) -> ${sheetName}!D${rowNumber} & F${rowNumber} (Row ${rowNumber})`
        );
      }
    });

    if (batchUpdates.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nessun dato o serie completata da sincronizzare. Completa almeno una serie o aggiungi un feedback.",
        },
        { status: 400 }
      );
    }

    // Optional self-healing cleanup: if syncing Giorno A on S1, check if Row 40/41 was polluted by earlier mis-routed sync
    if (dayIndex === 0) {
      try {
        const checkRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
            sheetName
          )}!D7:F41`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (checkRes.ok) {
          const checkData = (await checkRes.json()) as { values?: string[][] };
          const checkRows = checkData.values || [];
          // Row 7 is index 0 in D7:F41; Row 40 is index 33; Row 41 is index 34
          const row7 = checkRows[0] || [];
          const row40 = checkRows[33] || [];
          const row41 = checkRows[34] || [];
          const d40Val = (row40[0] || "").trim();
          const d41Val = (row41[0] || "").trim();

          // If D40 (header row for Day 4) was overwritten with set data (e.g. "1°... set ..."), restore header from Row 7
          if (d40Val.includes("set")) {
            batchUpdates.push({
              range: `${sheetName}!D40`,
              values: [[row7[0] || "KG"]],
            });
            batchUpdates.push({
              range: `${sheetName}!F40`,
              values: [[row7[2] || "FEEDBACK ATLETA"]],
            });
          }

          // If D41 equals Exercise 2's KG value from Giorno A, clear D41 & F41
          const ex1Sets = (exercises[1]?.sets || []).filter(
            (s: SyncSet) => s.reps > 0 || s.weight > 0
          );
          const ex1KgVal = formatExerciseKgValue(ex1Sets);
          if (d40Val.includes("set") || (ex1KgVal && d41Val === ex1KgVal)) {
            batchUpdates.push({
              range: `${sheetName}!D41`,
              values: [[""]],
            });
            batchUpdates.push({
              range: `${sheetName}!F41`,
              values: [[""]],
            });
          }
        }
      } catch (cleanupErr) {
        console.warn("Non-critical cleanup check skipped:", cleanupErr);
      }
    }

    // 5. Write all updates in a single batch call to Google Sheets API
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: batchUpdates,
        }),
      }
    );

    if (!writeRes.ok) {
      const errText = await writeRes.text();
      return NextResponse.json(
        { error: `Errore durante la scrittura su Fogli Google: ${errText}` },
        { status: writeRes.status }
      );
    }

    // 6. Format feedback cells (Column F, index 5) to font size 9
    if (targetSheetId !== undefined && updatedRowNumbers.length > 0) {
      const formattingRequests = updatedRowNumbers.map((rowNumber) => ({
        repeatCell: {
          range: {
            sheetId: targetSheetId,
            startRowIndex: rowNumber - 1,
            endRowIndex: rowNumber,
            startColumnIndex: 5, // Column F (0-based)
            endColumnIndex: 6,
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                fontSize: 9,
              },
            },
          },
          fields: "userEnteredFormat.textFormat.fontSize",
        },
      }));

      try {
        const formatRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requests: formattingRequests,
            }),
          }
        );
        if (!formatRes.ok) {
          console.error("Feedback cell format warning:", await formatRes.text());
        }
      } catch (err) {
        console.error("Error formatting feedback cells:", err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Allenamento sincronizzato con successo in '${sheetName}' (Giorno ${currentConfig.letter}) su '${matchedFile.name}'!`,
      syncedCount: updatedRowNumbers.length,
      sheetName,
      day: currentConfig.letter,
      rows: `${currentConfig.startRow}-${currentConfig.endRow}`,
      fileName: matchedFile.name,
    });
  } catch (error: unknown) {
    console.error("Sheets sync error:", error);
    const msg = error instanceof Error ? error.message : "Errore interno del server.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
