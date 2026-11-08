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



export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const typedSession = session as { accessToken?: string } | null;
    
    if (!typedSession || !typedSession.accessToken) {
      return NextResponse.json(
        { error: "Non autorizzato. Effettua l'accesso con Google." },
        { status: 401 }
      );
    }

    const body = await req.json() as { workoutName?: string; exercises?: SyncExercise[]; dayIndex?: number };
    const { workoutName, exercises, dayIndex: bodyDayIndex } = body;

    if (!workoutName || !exercises || !Array.isArray(exercises)) {
      return NextResponse.json(
        { error: "Dati della routine mancanti o non validi." },
        { status: 400 }
      );
    }

    const accessToken = typedSession.accessToken;

    // 1. Search for spreadsheet named "Scheda Cata 20" in user's Drive (non-trashed, latest modified first)
    let query = encodeURIComponent("name contains 'Scheda Cata 20' and mimeType='application/vnd.google-apps.spreadsheet' and trashed = false");
    let driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!driveRes.ok) {
      const errText = await driveRes.text();
      return NextResponse.json(
        { error: `Errore nella ricerca Drive: ${errText}` },
        { status: driveRes.status }
      );
    }

    let driveData = await driveRes.json() as GoogleDriveSearchResponse;

    // Fallback: If "Scheda Cata 20" is not found, search for most recent "Scheda Cata" spreadsheet
    if (!driveData.files || driveData.files.length === 0) {
      console.log("Specific 'Scheda Cata 20' not found, searching for latest 'Scheda Cata' file...");
      query = encodeURIComponent("name contains 'Scheda Cata' and mimeType='application/vnd.google-apps.spreadsheet' and trashed = false");
      driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime)`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (driveRes.ok) {
        driveData = await driveRes.json() as GoogleDriveSearchResponse;
      }
    }

    if (!driveData.files || driveData.files.length === 0) {
      return NextResponse.json(
        { error: "File 'Scheda Cata 20' non trovato su Google Drive. Assicurati che il foglio si chiami 'Scheda Cata 20'." },
        { status: 404 }
      );
    }

    const matchedFile = driveData.files[0];
    const spreadsheetId = matchedFile.id;
    console.log(`Using target Google Spreadsheet '${matchedFile.name}' (ID: ${spreadsheetId})`);

    // 2. Fetch spreadsheet metadata to get all sheet names and IDs dynamically
    const metadataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(title,sheetId)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    let sheetsMeta: { title: string; sheetId: number }[] = [];
    let sheetNames: string[] = [];
    if (metadataRes.ok) {
      const metadata = await metadataRes.json() as { sheets?: { properties: { title: string; sheetId: number } }[] };
      sheetsMeta = (metadata.sheets || []).map(s => s.properties);
      sheetNames = sheetsMeta.map(s => s.title);
      console.log("Spreadsheet sheets metadata:", sheetsMeta);
    } else {
      console.error("Failed to fetch spreadsheet metadata:", await metadataRes.text());
    }

    let sheetName = "";
    if (sheetNames.length > 0) {
      const nameLower = workoutName.toLowerCase();
      
      // A. Check if workoutName contains any full sheet title (case-insensitive)
      // e.g. sheet is "S1" or "Settimana 1" and workoutName is "Petto Dorso S1"
      for (const sheet of sheetNames) {
        if (nameLower.includes(sheet.toLowerCase())) {
          sheetName = sheet;
          break;
        }
      }

      // B. If not matched, try matching specific patterns to find week number (S1..S6, W1..W6, Settimana 1..6)
      if (!sheetName) {
        const patterns = [
          /\b[sS]\s*([1-6])\b/,       // Matches S1..S6, s 1..s 6
          /\b[wW]\s*([1-6])\b/,       // Matches W1..W6
          /settimana\s*([1-6])\b/i,   // Matches Settimana 1..6
          /week\s*([1-6])\b/i,        // Matches Week 1..6
        ];
        
        for (const pattern of patterns) {
          const match = workoutName.match(pattern);
          if (match) {
            const num = match[1];
            const foundSheet = sheetNames.find(sheet => {
              const sheetLower = sheet.toLowerCase();
              return sheetLower === `s${num}` || sheetLower === `w${num}` || sheetLower === `settimana ${num}` || sheetLower === `week ${num}`;
            });
            if (foundSheet) {
              sheetName = foundSheet;
              break;
            }
          }
        }
      }

      // If still not matched, default to sheet S1
      if (!sheetName) {
        const defaultS1 = sheetNames.find(s => s.toLowerCase() === "s1" || s.toLowerCase().includes("s1"));
        if (defaultS1) {
          sheetName = defaultS1;
        }
      }
    }

    // C. Fallback to regex parsing if metadata fetch failed or didn't match
    if (!sheetName) {
      const sMatch = workoutName.match(/\b[sS]\s*([1-6])\b/);
      const wMatch = workoutName.match(/\b[wW]\s*([1-6])\b/);
      const settMatch = workoutName.match(/settimana\s*([1-6])\b/i);
      const weekMatch = workoutName.match(/week\s*([1-6])\b/i);
      
      let weekIndex = "1";
      if (sMatch) {
        weekIndex = sMatch[1];
      } else if (wMatch) {
        weekIndex = wMatch[1];
      } else if (settMatch) {
        weekIndex = settMatch[1];
      } else if (weekMatch) {
        weekIndex = weekMatch[1];
      }
      
      sheetName = `S${weekIndex}`;
    }

    console.log(`Resolved sheet name for workout '${workoutName}': '${sheetName}'`);

    const matchedSheetMeta = sheetsMeta.find(s => s.title === sheetName);
    const targetSheetId = matchedSheetMeta ? matchedSheetMeta.sheetId : 0;

    // 3. Determine Day Index (0 = Day 1 Squat, 1 = Day 2 Bench, 2 = Day 3 Deadlift, 3 = Day 4 SBD)
    const nameLower = workoutName.toLowerCase().trim();
    let dayIndex = -1;

    if (bodyDayIndex !== undefined && typeof bodyDayIndex === "number" && bodyDayIndex >= 0 && bodyDayIndex <= 3) {
      dayIndex = bodyDayIndex;
    } else {
      // 1. Check for Day 4 (SBD / Total Upper / Richiamo / Full Body / Day 4 / Routine 4 / Quarta routine)
      if (
        nameLower.includes("sbd") || 
        nameLower.includes("total upper") || 
        nameLower.includes("richiamo") || 
        nameLower.includes("full body") ||
        nameLower.includes("day 4") || 
        nameLower.includes("giorno 4") || 
        nameLower.includes("routine 4") ||
        nameLower.includes("allenamento 4") ||
        nameLower.includes("quarta routine") ||
        nameLower.includes("routine d") ||
        nameLower.includes("allenamento d") ||
        /^(4[\.\)\:\s_-]|d[\.\)\:\s_-])/i.test(workoutName.trim())
      ) {
        dayIndex = 3;
      }
      // 2. Check for Day 3 (Deadlift / Stacco / Gambe / Lower / Legs / Day 3 / Routine 3 / Terza routine)
      else if (
        nameLower.includes("deadlift") || 
        nameLower.includes("stacco") || 
        nameLower.includes("gambe") || 
        nameLower.includes("lower") || 
        nameLower.includes("legs") ||
        nameLower.includes("day 3") || 
        nameLower.includes("giorno 3") || 
        nameLower.includes("routine 3") ||
        nameLower.includes("allenamento 3") ||
        nameLower.includes("terza routine") ||
        nameLower.includes("routine c") ||
        nameLower.includes("allenamento c") ||
        /^(3[\.\)\:\s_-]|c[\.\)\:\s_-])/i.test(workoutName.trim())
      ) {
        dayIndex = 2;
      }
      // 3. Check for Day 2 (Bench / Panca / Spalle Braccia / Day 2 / Routine 2 / Seconda routine)
      else if (
        nameLower.includes("bench") || 
        nameLower.includes("panca") || 
        nameLower.includes("spalle") || 
        nameLower.includes("braccia") || 
        nameLower.includes("upper") || 
        nameLower.includes("day 2") || 
        nameLower.includes("giorno 2") || 
        nameLower.includes("routine 2") ||
        nameLower.includes("allenamento 2") ||
        nameLower.includes("seconda routine") ||
        nameLower.includes("routine b") ||
        nameLower.includes("allenamento b") ||
        /^(2[\.\)\:\s_-]|b[\.\)\:\s_-])/i.test(workoutName.trim())
      ) {
        dayIndex = 1;
      }
      // 4. Check for Day 1 (Squat / Petto Dorso / Day 1 / Routine 1 / Prima routine)
      else if (
        nameLower.includes("squat") || 
        nameLower.includes("petto") || 
        nameLower.includes("dorso") || 
        nameLower.includes("day 1") || 
        nameLower.includes("giorno 1") || 
        nameLower.includes("routine 1") ||
        nameLower.includes("allenamento 1") ||
        nameLower.includes("prima routine") ||
        nameLower.includes("routine a") ||
        nameLower.includes("allenamento a") ||
        /^(1[\.\)\:\s_-]|a[\.\)\:\s_-])/i.test(workoutName.trim())
      ) {
        dayIndex = 0;
      }

      // Secondary Check: If name was generic, inspect exercise names
      if (dayIndex === -1 && exercises && exercises.length > 0) {
        const exNames = exercises.map(e => (e.exerciseName || "").toLowerCase());
        const hasSquat = exNames.some(n => n.includes("squat"));
        const hasBench = exNames.some(n => n.includes("bench") || n.includes("panca"));
        const hasDeadlift = exNames.some(n => n.includes("deadlift") || n.includes("stacco"));

        if (hasSquat && (hasBench || hasDeadlift)) {
          dayIndex = 3; // SBD
        } else if (hasDeadlift && !hasBench) {
          dayIndex = 2; // Deadlift
        } else if (hasBench && !hasSquat && !hasDeadlift) {
          dayIndex = 1; // Bench
        } else if (hasSquat && !hasBench && !hasDeadlift) {
          dayIndex = 0; // Squat
        }
      }

      // Final fallback: search for number 1 to 4 in name, or default to Day 1 (Squat)
      if (dayIndex === -1) {
        const match = workoutName.match(/\b([1-4])\b/);
        if (match) {
          dayIndex = parseInt(match[1], 10) - 1;
        } else {
          dayIndex = 0; // Default Day 1 (Squat)
        }
      }
    }

    // Exact row specifications for Scheda Cata 20 (identical across S1..S6):
    // Day 1: Squat, rows 8 to 13
    // Day 2: Bench, rows 19 to 24
    // Day 3: Deadlift, rows 30 to 35
    // Day 4: SBD, rows 41 to 45
    const DAY_CONFIG = [
      { day: 1, name: "Squat", startRow: 8, endRow: 13 },
      { day: 2, name: "Bench", startRow: 19, endRow: 24 },
      { day: 3, name: "Deadlift", startRow: 30, endRow: 35 },
      { day: 4, name: "SBD", startRow: 41, endRow: 45 },
    ];

    const currentConfig = DAY_CONFIG[dayIndex];
    console.log(`Parsed workout '${workoutName}' -> Day ${currentConfig.day} (${currentConfig.name}): Rows ${currentConfig.startRow} to ${currentConfig.endRow}`);

    // 4. Construct batch updates for Column D (KG) and Column F (Feedback Atleta)
    const batchUpdates: GoogleSheetBatchUpdate[] = [];
    const updatedRows: number[] = [];

    exercises.forEach((ex: SyncExercise, exIdx: number) => {
      const rowNumber = currentConfig.startRow + exIdx;
      if (rowNumber > currentConfig.endRow) {
        console.warn(`Exercise index ${exIdx} (${ex.exerciseName}) exceeds Day ${currentConfig.day} max row ${currentConfig.endRow}, skipping.`);
        return;
      }

      const rawSets = ex.sets || [];
      const sets = rawSets.filter((s: SyncSet) => s.reps > 0 || s.weight > 0);

      if (sets.length > 0 || ex.feedback) {
        updatedRows.push(rowNumber);

        // Map sets to include adjusted reps (subtract 0.5 reps if Failure tag is present)
        const adjustedSets = sets.map((s: SyncSet) => ({
          ...s,
          adjustedReps: s.type === "F" ? s.reps - 0.5 : s.reps
        }));

        // Format KG Column (Column D)
        const allIdentical = adjustedSets.length > 0 && adjustedSets.every(
          (s) => s.weight === adjustedSets[0].weight && 
                 s.adjustedReps === adjustedSets[0].adjustedReps &&
                 (s.rpe === undefined ? 0 : parseFloat(s.rpe.toString().replace(",", "."))) === 
                 (adjustedSets[0].rpe === undefined ? 0 : parseFloat(adjustedSets[0].rpe.toString().replace(",", ".")))
        );

        let kgValue = "";
        if (adjustedSets.length > 0) {
          if (allIdentical) {
            const ordinals = ["1°", "2°", "3°", "4°", "5°", "6°"].slice(0, adjustedSets.length).join(", ");
            const formattedWeight = adjustedSets[0].weight.toString().replace(".", ",");
            const formattedReps = adjustedSets[0].adjustedReps.toString().replace(".", ",");
            const rpeVal = adjustedSets[0].rpe ? parseFloat(adjustedSets[0].rpe.toString().replace(",", ".")) : 0;
            const rpeSuffix = rpeVal > 0 ? ` @ ${rpeVal.toString().replace(".", ",")}` : "";
            kgValue = `${ordinals} set ${formattedWeight} x ${formattedReps}${rpeSuffix}`;
          } else {
            kgValue = adjustedSets
              .map((s, idx: number) => {
                const formattedWeight = s.weight.toString().replace(".", ",");
                const formattedReps = s.adjustedReps.toString().replace(".", ",");
                const rpeVal = s.rpe ? parseFloat(s.rpe.toString().replace(",", ".")) : 0;
                const rpeSuffix = rpeVal > 0 ? ` @ ${rpeVal.toString().replace(".", ",")}` : "";
                return `${idx + 1}° set ${formattedWeight} x ${formattedReps}${rpeSuffix}`;
              })
              .join("\n");
          }
        }

        // Batch add values for Column D (KG)
        batchUpdates.push({
          range: `${sheetName}!D${rowNumber}`,
          values: [[kgValue]],
        });

        // Batch add values for Column F (Feedback Atleta)
        batchUpdates.push({
          range: `${sheetName}!F${rowNumber}`,
          values: [[ex.feedback || ""]],
        });

        console.log(`Writing Exercise ${exIdx + 1} (${ex.exerciseName}) -> Row ${rowNumber} (D${rowNumber}, F${rowNumber})`);
      }
    });

    if (batchUpdates.length === 0) {
      return NextResponse.json({
        message: "Nessun esercizio della routine corrispondeva al foglio per questa giornata.",
        syncedCount: 0,
      });
    }

    // 7. Write all cellular updates in a single batch call to Google Sheets API
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
        { error: `Errore durante la scrittura: ${errText}` },
        { status: writeRes.status }
      );
    }

    // 8. Format feedback cells to font size 9 (Column F)
    if (targetSheetId && updatedRows.length > 0) {
      const formattingRequests = updatedRows.map((rowNumber) => ({
        repeatCell: {
          range: {
            sheetId: targetSheetId,
            startRowIndex: rowNumber - 1,
            endRowIndex: rowNumber,
            startColumnIndex: 5, // Column F (0-based)
            endColumnIndex: 6    // Column F exclusive
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                fontSize: 9
              }
            }
          },
          fields: "userEnteredFormat.textFormat.fontSize"
        }
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
          console.error("Failed to apply font size 9 formatting:", await formatRes.text());
        } else {
          console.log("Successfully formatted feedback cells to font size 9");
        }
      } catch (err) {
        console.error("Error formatting feedback cells:", err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Allenamento sincronizzato con successo su Google Sheets in '${sheetName}'!`,
      syncedCount: batchUpdates.length / 2,
    });
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const msg = error instanceof Error ? error.message : "Errore di server.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
