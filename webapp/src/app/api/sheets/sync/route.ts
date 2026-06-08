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

    const body = await req.json() as { workoutName?: string; exercises?: SyncExercise[] };
    const { workoutName, exercises } = body;

    if (!workoutName || !exercises || !Array.isArray(exercises)) {
      return NextResponse.json(
        { error: "Dati della routine mancanti o non validi." },
        { status: 400 }
      );
    }

    const accessToken = typedSession.accessToken;

    // 1. Search for spreadsheet named "Scheda Cata 19" in user's Drive
    const query = encodeURIComponent("name='Scheda Cata 19' and mimeType='application/vnd.google-apps.spreadsheet'");
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
        { error: "File 'Scheda Cata 19' non trovato su Google Drive. Assicurati che si chiami esattamente così." },
        { status: 404 }
      );
    }

    const spreadsheetId = driveData.files[0].id;

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
      // e.g. sheet is "Settimana 18" and workoutName is "Giorno A Settimana 18"
      for (const sheet of sheetNames) {
        if (nameLower.includes(sheet.toLowerCase())) {
          sheetName = sheet;
          break;
        }
      }

      // B. If not matched, try matching specific patterns to find week number
      if (!sheetName) {
        const patterns = [
          /w\s*(\d+)/i,        // Matches W7, W18, w 7, w 18 (user's primary format)
          /settimana\s*(\d+)/i,
          /week\s*(\d+)/i,
          /\b(\d+)\b/          // any standalone number
        ];
        
        for (const pattern of patterns) {
          const match = workoutName.match(pattern);
          if (match) {
            const num = match[1];
            // Look for a sheet that contains this number (e.g. number "18" matches sheet "Settimana 18")
            const foundSheet = sheetNames.find(sheet => {
              const sheetNumbers = (sheet.match(/\b\d+\b/g) || []) as string[];
              return sheetNumbers.includes(num) || sheet.toLowerCase().includes(num);
            });
            if (foundSheet) {
              sheetName = foundSheet;
              break;
            }
          }
        }
      }
    }

    // C. Fallback to regex parsing if metadata fetch failed or didn't match
    if (!sheetName) {
      const wMatch = workoutName.match(/w\s*(\d+)/i);
      const settMatch = workoutName.match(/settimana\s*(\d+)/i);
      const weekMatch = workoutName.match(/week\s*(\d+)/i);
      const genericNumberMatch = workoutName.match(/\b(\d+)\b/);
      
      let weekIndex = "1";
      if (wMatch) {
        weekIndex = wMatch[1];
      } else if (settMatch) {
        weekIndex = settMatch[1];
      } else if (weekMatch) {
        weekIndex = weekMatch[1];
      } else if (genericNumberMatch) {
        weekIndex = genericNumberMatch[1];
      }
      
      sheetName = `Settimana ${weekIndex}`;
    }

    console.log(`Resolved sheet name for workout '${workoutName}': '${sheetName}'`);

    const matchedSheetMeta = sheetsMeta.find(s => s.title === sheetName);
    const targetSheetId = matchedSheetMeta ? matchedSheetMeta.sheetId : 0;

    // 3. Parse routine day index:
    // - petto dorso -> Day 0
    // - spalle braccia -> Day 1
    // - gambe -> Day 2
    // - total upper body -> Day 3
    const nameLower = workoutName.toLowerCase();
    let dayIndex = 0; // Default Day 0 (petto dorso)

    if (nameLower.includes("petto dorso") || nameLower.includes("petto - dorso") || nameLower.includes("petto/dorso") || nameLower.includes("petto e dorso")) {
      dayIndex = 0;
    } else if (nameLower.includes("spalle braccia") || nameLower.includes("spalle - braccia") || nameLower.includes("spalle/braccia") || nameLower.includes("spalle e braccia") || nameLower.includes("spalle, braccia")) {
      dayIndex = 1;
    } else if (nameLower.includes("gambe")) {
      dayIndex = 2;
    } else if (nameLower.includes("total upper") || nameLower.includes("total upper body") || nameLower.includes("upper body")) {
      dayIndex = 3;
    } else {
      // Fallback to old names or simple letter indicators
      if (nameLower.includes("upper a") || nameLower.includes("giorno a") || nameLower.includes("upper_a")) dayIndex = 0;
      else if (nameLower.includes("lower a") || nameLower.includes("giorno b") || nameLower.includes("lower_a")) dayIndex = 1;
      else if (nameLower.includes("upper b") || nameLower.includes("giorno c") || nameLower.includes("upper_b")) dayIndex = 2;
      else if (nameLower.includes("lower b") || nameLower.includes("giorno d") || nameLower.includes("lower_b")) dayIndex = 3;
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

    // 5. Locate row index boundaries for petto dorso, spalle braccia, gambe, total upper body
    let day0Row = -1;
    let day1Row = -1;
    let day2Row = -1;
    let day3Row = -1;

    rows.forEach((row, idx) => {
      const colA = row[0] ? row[0].toLowerCase() : "";
      
      // Match Day 0 (petto dorso)
      if (day0Row === -1 && (
        (colA.includes("petto") && colA.includes("dorso")) || 
        colA.includes("petto dorso") || 
        colA.includes("giorno a") || 
        colA.includes("upper a")
      )) {
        day0Row = idx;
      }
      // Match Day 1 (spalle braccia)
      else if (day1Row === -1 && (
        (colA.includes("spalle") && colA.includes("braccia")) || 
        colA.includes("spalle braccia") || 
        colA.includes("giorno b") || 
        colA.includes("lower a")
      )) {
        day1Row = idx;
      }
      // Match Day 2 (gambe)
      else if (day2Row === -1 && (
        colA.includes("gambe") || 
        colA.includes("giorno c") || 
        colA.includes("upper b")
      )) {
        day2Row = idx;
      }
      // Match Day 3 (total upper body)
      else if (day3Row === -1 && (
        colA.includes("total upper") || 
        colA.includes("upper body") || 
        colA.includes("giorno d") || 
        colA.includes("lower b")
      )) {
        day3Row = idx;
      }
    });

    console.log("Day row boundaries resolved:", { day0Row, day1Row, day2Row, day3Row });

    let startRow = 0;
    let endRow = rows.length;

    const dayStartRows = [day0Row, day1Row, day2Row, day3Row];
    const targetStart = dayStartRows[dayIndex];
    if (targetStart !== -1) {
      startRow = targetStart;
      // End row is the first subsequent day block that is found
      let nextStart = -1;
      for (let i = dayIndex + 1; i < dayStartRows.length; i++) {
        if (dayStartRows[i] !== -1) {
          nextStart = dayStartRows[i];
          break;
        }
      }
      if (nextStart !== -1) {
        endRow = nextStart;
      }
    }

    // 6. Match and update rows within the resolved day block
    const batchUpdates: GoogleSheetBatchUpdate[] = [];

    // Extract all valid exercise rows inside the target spreadsheet day block to allow positional fallback
    const sheetExerciseRows: { rowIdx: number; name: string }[] = [];
    for (let r = startRow + 1; r < endRow; r++) {
      if (!rows[r]) continue;
      const colA = rows[r][0] ? rows[r][0].trim() : "";
      // Skip empty rows, day headers, volume metrics, or totals
      if (
        colA === "" || 
        colA.toLowerCase().includes("giorno") || 
        colA.toLowerCase().includes("volume") || 
        colA.toLowerCase().includes("totale")
      ) {
        continue;
      }
      // Skip table header rows (containing terms like "esercizio", "kg", "feedback", "target", etc.)
      const isHeaderRow = rows[r].some((cell) => {
        if (!cell) return false;
        const c = cell.toLowerCase().trim();
        return (
          c.includes("esercizio") || 
          c === "target" || 
          c === "kg" || 
          c === "rpe" || 
          c.includes("feedback") || 
          c.includes("atleta") || 
          c === "rest" || 
          c === "recupero" || 
          c === "serie" || 
          c === "reps"
        );
      });
      if (isHeaderRow) continue;

      sheetExerciseRows.push({ rowIdx: r, name: colA });
    }

    const matchedRowIndices = new Set<number>();
    const matchedExToRow = new Map<number, number>(); // exIdx -> rowIdx

    // Phase 1: Match by name (exact or containment)
    exercises.forEach((ex: SyncExercise, exIdx: number) => {
      const exNameNormalized = ex.exerciseName.toLowerCase().replace(/[^a-z0-9]/g, "");

      for (let r = startRow; r < endRow; r++) {
        if (!rows[r] || !rows[r][0]) continue;
        const colA = rows[r][0].trim();
        if (colA.toLowerCase().includes("giorno")) continue;

        // Skip table header rows
        const isHeaderRow = rows[r].some((cell) => {
          if (!cell) return false;
          const c = cell.toLowerCase().trim();
          return (
            c.includes("esercizio") || 
            c === "target" || 
            c === "kg" || 
            c === "rpe" || 
            c.includes("feedback") || 
            c.includes("atleta") || 
            c === "rest" || 
            c === "recupero" || 
            c === "serie" || 
            c === "reps"
          );
        });
        if (isHeaderRow) continue;

        const rowExName = colA.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (rowExName === exNameNormalized || rowExName.includes(exNameNormalized) || exNameNormalized.includes(rowExName)) {
          if (!matchedRowIndices.has(r)) {
            matchedRowIndices.add(r);
            matchedExToRow.set(exIdx, r);
            break;
          }
        }
      }
    });

    // Phase 2: Positional index matching fallback (if not matched by name)
    exercises.forEach((ex: SyncExercise, exIdx: number) => {
      if (matchedExToRow.has(exIdx)) return; // Already matched by name

      if (sheetExerciseRows[exIdx] !== undefined) {
        const fallbackRowIdx = sheetExerciseRows[exIdx].rowIdx;
        if (!matchedRowIndices.has(fallbackRowIdx)) {
          matchedRowIndices.add(fallbackRowIdx);
          matchedExToRow.set(exIdx, fallbackRowIdx);
          console.log(`Matched unmatched exercise '${ex.exerciseName}' (index ${exIdx}) by position to sheet row ${fallbackRowIdx + 1} ('${sheetExerciseRows[exIdx].name}')`);
        }
      }
    });

    // Find the feedback column index dynamically by scanning the header row in the day block
    let feedbackColIdx = 5; // Default: Column F (0-based index 5)
    for (let r = startRow; r < endRow; r++) {
      if (!rows[r]) continue;
      const isHeader = rows[r].some((cell) => {
        if (!cell) return false;
        const c = cell.toLowerCase().trim();
        return c.includes("esercizio") || c === "kg" || c.includes("feedback") || c.includes("atleta");
      });
      
      if (isHeader) {
        // Prioritize "feedback atleta" column matching over coach feedback
        let idx = rows[r].findIndex((cell) => {
          if (!cell) return false;
          const c = cell.toLowerCase().trim();
          return c.includes("feedback atleta") || (c.includes("feedback") && c.includes("atleta"));
        });
        if (idx === -1) {
          idx = rows[r].findIndex((cell) => {
            if (!cell) return false;
            const c = cell.toLowerCase().trim();
            return c.includes("feedback");
          });
        }
        if (idx !== -1) {
          feedbackColIdx = idx;
          console.log(`Found feedback column dynamically at index ${feedbackColIdx} (Column ${String.fromCharCode(65 + feedbackColIdx)})`);
          break;
        }
      }
    }
    const feedbackColLetter = String.fromCharCode(65 + feedbackColIdx);

    // Phase 3: Construct batch updates for all successfully matched exercises
    exercises.forEach((ex: SyncExercise, exIdx: number) => {
      const matchedRowIdx = matchedExToRow.get(exIdx);
      if (matchedRowIdx === undefined) return;

      const rowNumber = matchedRowIdx + 1; // 1-based row index for Google Sheets
      const sets = ex.sets || [];

      if (sets.length > 0) {
        // Map sets to include adjusted reps (subtract 0.5 reps if Failure tag is present)
        const adjustedSets = sets.map((s: SyncSet) => ({
          ...s,
          adjustedReps: s.type === "F" ? s.reps - 0.5 : s.reps
        }));

        // Format KG Column (Column D)
        const allIdentical = adjustedSets.every(
          (s) => s.weight === adjustedSets[0].weight && 
                 s.adjustedReps === adjustedSets[0].adjustedReps &&
                 (s.rpe === undefined ? 0 : parseFloat(s.rpe.toString().replace(",", "."))) === 
                 (adjustedSets[0].rpe === undefined ? 0 : parseFloat(adjustedSets[0].rpe.toString().replace(",", ".")))
        );

        let kgValue = "";
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

        // Batch add values for Column D (KG)
        batchUpdates.push({
          range: `${sheetName}!D${rowNumber}`,
          values: [[kgValue]],
        });

        // Batch add values for Column F/G (Feedback Atleta) resolved dynamically
        batchUpdates.push({
          range: `${sheetName}!${feedbackColLetter}${rowNumber}`,
          values: [[ex.feedback || ""]],
        });
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

    // 8. Format feedback cells to font size 9 (if we have targetSheetId and matched exercises)
    if (targetSheetId && matchedExToRow.size > 0) {
      const formattingRequests = Array.from(matchedExToRow.values()).map((rowIdx) => ({
        repeatCell: {
          range: {
            sheetId: targetSheetId,
            startRowIndex: rowIdx,
            endRowIndex: rowIdx + 1,
            startColumnIndex: feedbackColIdx,
            endColumnIndex: feedbackColIdx + 1
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
