import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface SyncSet {
  weight: number;
  reps: number;
  rpe?: number;
}

interface SyncExercise {
  exerciseName: string;
  sets: SyncSet[];
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

    const body = await req.json() as { workoutName?: string; exercises?: SyncExercise[] };
    const { workoutName, exercises } = body;

    if (!workoutName || !exercises || !Array.isArray(exercises)) {
      return NextResponse.json(
        { error: "Dati della routine mancanti o non validi." },
        { status: 400 }
      );
    }

    const accessToken = typedSession.accessToken;

    // 1. Search for spreadsheet named "Scheda Cata 18" in user's Drive
    const query = encodeURIComponent("name='Scheda Cata 18' and mimeType='application/vnd.google-apps.spreadsheet'");
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
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

    const driveData = await driveRes.json() as GoogleDriveSearchResponse;
    if (!driveData.files || driveData.files.length === 0) {
      return NextResponse.json(
        { error: "File 'Scheda Cata 18' non trovato su Google Drive. Assicurati che si chiami esattamente così." },
        { status: 404 }
      );
    }

    const spreadsheetId = driveData.files[0].id;

    // 2. Parse week index from workoutName (e.g. "Upper B W7" -> Week 7)
    // Supports formats: W7, W 7, Settimana 7, etc.
    const weekMatch = workoutName.match(/W\s*(\d+)/i);
    const weekIndex = weekMatch ? weekMatch[1] : "1";
    const sheetName = `Settimana ${weekIndex}`;

    // 3. Parse routine day index (upper A -> Day 0, lower A -> Day 1, upper B -> Day 2, lower B -> Day 3)
    const nameLower = workoutName.toLowerCase();
    let dayIndex = 0; // Default Giorno A

    if (nameLower.includes("upper a") || nameLower.includes("giorno a") || nameLower.includes("upper_a")) {
      dayIndex = 0;
    } else if (nameLower.includes("lower a") || nameLower.includes("giorno b") || nameLower.includes("lower_a")) {
      dayIndex = 1;
    } else if (nameLower.includes("upper b") || nameLower.includes("giorno c") || nameLower.includes("upper_b")) {
      dayIndex = 2;
    } else if (nameLower.includes("lower b") || nameLower.includes("giorno d") || nameLower.includes("lower_b")) {
      dayIndex = 3;
    } else {
      // Fallback matching simple letters A, B, C, D if present in isolation
      if (nameLower.includes("giorno a") || nameLower.includes("giorno_a")) dayIndex = 0;
      else if (nameLower.includes("giorno b") || nameLower.includes("giorno_b")) dayIndex = 1;
      else if (nameLower.includes("giorno c") || nameLower.includes("giorno_c")) dayIndex = 2;
      else if (nameLower.includes("giorno d") || nameLower.includes("giorno_d")) dayIndex = 3;
    }

    // 4. Fetch the values for columns A to G (up to row 50) of the parsed week sheet
    const sheetRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:G50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!sheetRes.ok) {
      return NextResponse.json(
        { error: `Foglio '${sheetName}' non trovato nella scheda. Assicurati che esista.` },
        { status: 404 }
      );
    }

    const sheetData = await sheetRes.json() as { values?: string[][] };
    const rows = sheetData.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: `Nessun dato trovato nel foglio '${sheetName}'.` },
        { status: 400 }
      );
    }

    // 5. Locate row index boundaries for Giorno A, B, C, D
    const dayRows: number[] = [];
    rows.forEach((row, idx) => {
      const colA = row[0] ? row[0].toLowerCase() : "";
      if (colA.includes("giorno a") || colA.includes("giorno b") || colA.includes("giorno c") || colA.includes("giorno d")) {
        dayRows.push(idx);
      }
    });

    if (dayRows.length < 4) {
      console.log("Day boundaries found:", dayRows);
    }

    // Determine target block boundary
    const startRow = dayRows[dayIndex] !== undefined ? dayRows[dayIndex] : 0;
    const nextIndex = dayIndex + 1;
    const endRow = (dayRows[nextIndex] !== undefined) ? dayRows[nextIndex] : rows.length;

    // 6. Match and update rows within the resolved day block
    const batchUpdates: GoogleSheetBatchUpdate[] = [];

    exercises.forEach((ex: SyncExercise) => {
      const exNameNormalized = ex.exerciseName.toLowerCase().replace(/[^a-z0-9]/g, "");

      // Search row inside the range [startRow, endRow]
      let matchedRowIdx = -1;
      for (let r = startRow; r < endRow; r++) {
        if (!rows[r] || !rows[r][0]) continue;
        const rowExName = rows[r][0].toLowerCase().replace(/[^a-z0-9]/g, "");
        if (rowExName === exNameNormalized || rowExName.includes(exNameNormalized) || exNameNormalized.includes(rowExName)) {
          matchedRowIdx = r;
          break;
        }
      }

      if (matchedRowIdx !== -1) {
        const rowNumber = matchedRowIdx + 1; // 1-based row index for Google Sheets
        const sets = ex.sets || [];

        if (sets.length > 0) {
          // Format KG Column (Column D)
          const allIdentical = sets.every(
            (s: SyncSet) => s.weight === sets[0].weight && s.reps === sets[0].reps
          );

          let kgValue = "";
          if (allIdentical) {
            const ordinals = ["1°", "2°", "3°", "4°", "5°", "6°"].slice(0, sets.length).join(", ");
            const formattedWeight = sets[0].weight.toString().replace(".", ",");
            kgValue = `${ordinals} set ${formattedWeight} x ${sets[0].reps}`;
          } else {
            kgValue = sets
              .map((s: SyncSet, idx: number) => {
                const formattedWeight = s.weight.toString().replace(".", ",");
                return `${idx + 1}° set ${formattedWeight} x ${s.reps}`;
              })
              .join("\n");
          }

          // Format Feedback Column (Column F)
          const rpes = sets
            .map((s: SyncSet) => (s.rpe ? s.rpe.toString().replace(".", ",") : ""))
            .filter(Boolean);

          let feedbackValue = "";
          if (rpes.length > 0) {
            feedbackValue = `RPE ${rpes.join(" - ")}`;
          }

          // Batch add values for Columns D (KG) and F (Feedback)
          batchUpdates.push({
            range: `${sheetName}!D${rowNumber}`,
            values: [[kgValue]],
          });

          if (feedbackValue) {
            batchUpdates.push({
              range: `${sheetName}!F${rowNumber}`,
              values: [[feedbackValue]],
            });
          }
        }
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
