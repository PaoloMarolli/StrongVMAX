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
        { error: "Non autorizzato. Effettua l'accesso con il tuo account Google per sincronizzare." },
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
    // Supporting Shared Drives, all items, and non-trashed files ordered by modifiedTime desc
    const searchQueries = [
      "name contains 'Scheda Cata 21' and mimeType='application/vnd.google-apps.spreadsheet' and trashed = false",
      "name contains 'Cata 21' and mimeType='application/vnd.google-apps.spreadsheet' and trashed = false",
      "name contains 'Scheda Cata' and mimeType='application/vnd.google-apps.spreadsheet' and trashed = false",
      "name contains 'Cata' and mimeType='application/vnd.google-apps.spreadsheet' and trashed = false",
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

    // 2. Fetch spreadsheet metadata to get all sheet names and sheet IDs dynamically
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

    if (sheetNames.length === 0) {
      return NextResponse.json(
        { error: "Impossibile leggere i fogli della scheda Google. Verifica i permessi di lettura." },
        { status: 500 }
      );
    }

    // 3. Resolve target sheet/tab name
    let sheetName = "";
    const nameLower = workoutName.toLowerCase();

    // A. Direct containment check
    for (const sheet of sheetNames) {
      if (nameLower.includes(sheet.toLowerCase())) {
        sheetName = sheet;
        break;
      }
    }

    // B. Pattern matching for week number (S1..S12, W1..W12, Settimana 1..12, Sett 1..12, Week 1..12)
    if (!sheetName) {
      const patterns = [
        /\b[sS]\s*([1-9]|1[0-2])\b/,
        /\b[wW]\s*([1-9]|1[0-2])\b/,
        /settimana\s*([1-9]|1[0-2])\b/i,
        /sett\s*([1-9]|1[0-2])\b/i,
        /week\s*([1-9]|1[0-2])\b/i,
        /\b([1-9]|1[0-2])\b/,
      ];

      for (const pattern of patterns) {
        const match = workoutName.match(pattern);
        if (match) {
          const num = match[1];
          const found = sheetNames.find((sheet) => {
            const sl = sheet.toLowerCase();
            return (
              sl === `s${num}` ||
              sl === `w${num}` ||
              sl === `settimana ${num}` ||
              sl === `sett ${num}` ||
              sl === `week ${num}` ||
              sl.includes(`s${num}`) ||
              sl.includes(`settimana ${num}`) ||
              sl.includes(`week ${num}`) ||
              ((sheet.match(/\b\d+\b/g) || []) as string[]).includes(num)
            );
          });
          if (found) {
            sheetName = found;
            break;
          }
        }
      }
    }

    // C. Fallback: match default first week or pick the first sheet
    if (!sheetName) {
      const defaultS1 = sheetNames.find((s) => {
        const sl = s.toLowerCase();
        return (
          sl === "s1" ||
          sl === "settimana 1" ||
          sl === "sett 1" ||
          sl === "w1" ||
          sl.includes("s1") ||
          sl.includes("settimana 1")
        );
      });
      sheetName = defaultS1 || sheetNames[0];
    }

    console.log(`Resolved sheet name for workout '${workoutName}': '${sheetName}'`);

    const matchedSheetMeta = sheetsMeta.find((s) => s.title === sheetName);
    const targetSheetId = matchedSheetMeta ? matchedSheetMeta.sheetId : 0;

    // 4. Determine Day Index (0 = Day 1 Squat, 1 = Day 2 Bench, 2 = Day 3 Deadlift, 3 = Day 4 SBD)
    let dayIndex = -1;

    if (
      bodyDayIndex !== undefined &&
      typeof bodyDayIndex === "number" &&
      bodyDayIndex >= 0 &&
      bodyDayIndex <= 3
    ) {
      dayIndex = bodyDayIndex;
    } else {
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
        nameLower.includes("upper b") ||
        /^(4[\.\)\:\s_-]|d[\.\)\:\s_-])/i.test(workoutName.trim())
      ) {
        dayIndex = 3;
      } else if (
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
      } else if (
        nameLower.includes("bench") ||
        nameLower.includes("panca") ||
        nameLower.includes("spalle") ||
        nameLower.includes("braccia") ||
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
      } else if (
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
        nameLower.includes("upper a") ||
        /^(1[\.\)\:\s_-]|a[\.\)\:\s_-])/i.test(workoutName.trim())
      ) {
        dayIndex = 0;
      }

      // Secondary check: inspect exercises in routine
      if (dayIndex === -1 && exercises && exercises.length > 0) {
        const exNames = exercises.map((e) => (e.exerciseName || "").toLowerCase());
        const hasSquat = exNames.some((n) => n.includes("squat"));
        const hasBench = exNames.some((n) => n.includes("bench") || n.includes("panca"));
        const hasDeadlift = exNames.some((n) => n.includes("deadlift") || n.includes("stacco"));

        if (hasSquat && (hasBench || hasDeadlift)) {
          dayIndex = 3;
        } else if (hasDeadlift && !hasBench) {
          dayIndex = 2;
        } else if (hasBench && !hasSquat && !hasDeadlift) {
          dayIndex = 1;
        } else if (hasSquat && !hasBench && !hasDeadlift) {
          dayIndex = 0;
        }
      }

      if (dayIndex === -1) {
        const match = workoutName.match(/\b([1-4])\b/);
        if (match) {
          dayIndex = parseInt(match[1], 10) - 1;
        } else {
          dayIndex = 0;
        }
      }
    }

    const DAY_CONFIG = [
      { day: 1, name: "Squat", startRow: 8, endRow: 13 },
      { day: 2, name: "Bench", startRow: 19, endRow: 24 },
      { day: 3, name: "Deadlift", startRow: 30, endRow: 35 },
      { day: 4, name: "SBD", startRow: 41, endRow: 45 },
    ];
    const defaultDayConfig = DAY_CONFIG[dayIndex] || DAY_CONFIG[0];

    // 5. Fetch sheet cells to inspect dynamic day headers, columns, and exercise rows
    const sheetRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        sheetName
      )}!A1:G60`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    let rows: string[][] = [];
    if (sheetRes.ok) {
      const sheetData = (await sheetRes.json()) as { values?: string[][] };
      rows = sheetData.values || [];
    }

    // Dynamic detection of feedback column (defaults to F, index 5)
    let feedbackColLetter = "F";
    let feedbackColIdx = 5;

    if (rows.length > 0) {
      for (const row of rows.slice(0, 15)) {
        row.forEach((cell, cIdx) => {
          const cl = (cell || "").toLowerCase().trim();
          if (cl.includes("feedback") || cl.includes("atleta") || cl.includes("comment")) {
            feedbackColIdx = cIdx;
            feedbackColLetter = String.fromCharCode(65 + cIdx);
          }
        });
      }
    }

    // Identify day boundaries dynamically from rows if present
    let dynamicStartRow = -1;
    let dynamicEndRow = -1;

    if (rows.length > 0) {
      const dayHeaders: { dayIdx: number; rowIdx: number }[] = [];
      rows.forEach((row, rIdx) => {
        const colA = (row[0] || "").toLowerCase().trim();
        const colB = (row[1] || "").toLowerCase().trim();
        const text = `${colA} ${colB}`;

        if (
          (text.includes("squat") &&
            !text.includes("jump") &&
            !text.includes("bulgarian")) ||
          (text.includes("petto") && text.includes("dorso")) ||
          text.includes("giorno 1") ||
          text.includes("giorno a") ||
          text.includes("day 1") ||
          text.includes("upper a")
        ) {
          dayHeaders.push({ dayIdx: 0, rowIdx: rIdx + 1 });
        } else if (
          text.includes("bench") ||
          text.includes("panca") ||
          (text.includes("spalle") && text.includes("braccia")) ||
          text.includes("giorno 2") ||
          text.includes("giorno b") ||
          text.includes("day 2") ||
          text.includes("lower a")
        ) {
          dayHeaders.push({ dayIdx: 1, rowIdx: rIdx + 1 });
        } else if (
          text.includes("deadlift") ||
          text.includes("stacco") ||
          text.includes("gambe") ||
          text.includes("giorno 3") ||
          text.includes("giorno c") ||
          text.includes("day 3") ||
          text.includes("upper b")
        ) {
          dayHeaders.push({ dayIdx: 2, rowIdx: rIdx + 1 });
        } else if (
          text.includes("sbd") ||
          text.includes("total upper") ||
          text.includes("richiamo") ||
          text.includes("full body") ||
          text.includes("giorno 4") ||
          text.includes("giorno d") ||
          text.includes("day 4") ||
          text.includes("lower b")
        ) {
          dayHeaders.push({ dayIdx: 3, rowIdx: rIdx + 1 });
        }
      });

      const matchedHeader = dayHeaders.find((h) => h.dayIdx === dayIndex);
      if (matchedHeader) {
        dynamicStartRow = matchedHeader.rowIdx + 1;
        const nextHeader = dayHeaders.find((h) => h.rowIdx > matchedHeader.rowIdx);
        dynamicEndRow = nextHeader ? nextHeader.rowIdx - 1 : matchedHeader.rowIdx + 8;
      }
    }

    const startRow = dynamicStartRow > 0 ? dynamicStartRow : defaultDayConfig.startRow;
    const endRow = dynamicEndRow > 0 ? dynamicEndRow : defaultDayConfig.endRow;

    console.log(
      `Day ${dayIndex + 1} (${defaultDayConfig.name}): Rows ${startRow} to ${endRow} in sheet '${sheetName}'`
    );

    // 6. Map workout exercises to sheet rows
    const matchedExToRow = new Map<number, number>();
    const usedRows = new Set<number>();

    // Phase 1: Fuzzy / Name matching against sheet rows
    if (rows.length > 0) {
      exercises.forEach((ex, exIdx) => {
        const normEx = ex.exerciseName.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!normEx) return;

        for (let r = startRow; r <= Math.min(endRow, rows.length); r++) {
          const rowData = rows[r - 1];
          if (!rowData) continue;
          const colA = (rowData[0] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const colB = (rowData[1] || "").toLowerCase().replace(/[^a-z0-9]/g, "");

          if (
            (colA && (colA.includes(normEx) || normEx.includes(colA))) ||
            (colB && (colB.includes(normEx) || normEx.includes(colB)))
          ) {
            if (!usedRows.has(r)) {
              matchedExToRow.set(exIdx, r);
              usedRows.add(r);
              break;
            }
          }
        }
      });
    }

    // Phase 2: Sequential fallback mapping for remaining exercises
    let curRow = startRow;
    exercises.forEach((ex, exIdx) => {
      if (matchedExToRow.has(exIdx)) return;
      while (usedRows.has(curRow) && curRow <= endRow) {
        curRow++;
      }
      if (curRow <= endRow) {
        matchedExToRow.set(exIdx, curRow);
        usedRows.add(curRow);
        curRow++;
      }
    });

    // 7. Construct batch updates for Column D (KG) and Column F/Feedback
    const batchUpdates: GoogleSheetBatchUpdate[] = [];
    const updatedRowNumbers: number[] = [];

    exercises.forEach((ex: SyncExercise, exIdx: number) => {
      const rowNumber = matchedExToRow.get(exIdx);
      if (!rowNumber) return;

      const rawSets = ex.sets || [];
      const sets = rawSets.filter((s: SyncSet) => s.reps > 0 || s.weight > 0);

      if (sets.length > 0 || ex.feedback) {
        updatedRowNumbers.push(rowNumber);

        // Map sets to include adjusted reps (subtract 0.5 reps if Failure tag is present)
        const adjustedSets = sets.map((s: SyncSet) => ({
          ...s,
          adjustedReps: s.type === "F" ? s.reps - 0.5 : s.reps,
        }));

        let kgValue = "";
        if (adjustedSets.length > 0) {
          const allIdentical = adjustedSets.every(
            (s) =>
              s.weight === adjustedSets[0].weight &&
              s.adjustedReps === adjustedSets[0].adjustedReps &&
              (s.rpe === undefined
                ? 0
                : parseFloat(s.rpe.toString().replace(",", "."))) ===
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

        // Add Column D (KG)
        batchUpdates.push({
          range: `${sheetName}!D${rowNumber}`,
          values: [[kgValue]],
        });

        // Add Feedback Column
        batchUpdates.push({
          range: `${sheetName}!${feedbackColLetter}${rowNumber}`,
          values: [[ex.feedback || ""]],
        });

        console.log(
          `Syncing Exercise ${exIdx + 1} (${ex.exerciseName}) -> Row ${rowNumber} [D${rowNumber}, ${feedbackColLetter}${rowNumber}]`
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

    // 8. Write all updates in a single batch call to Google Sheets API
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

    // 9. Format feedback cells to font size 9
    if (targetSheetId && updatedRowNumbers.length > 0) {
      const formattingRequests = updatedRowNumbers.map((rowNumber) => ({
        repeatCell: {
          range: {
            sheetId: targetSheetId,
            startRowIndex: rowNumber - 1,
            endRowIndex: rowNumber,
            startColumnIndex: feedbackColIdx,
            endColumnIndex: feedbackColIdx + 1,
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
      message: `Allenamento sincronizzato con successo in '${sheetName}' su '${matchedFile.name}'!`,
      syncedCount: updatedRowNumbers.length,
      sheetName,
      fileName: matchedFile.name,
    });
  } catch (error: unknown) {
    console.error("Sheets sync error:", error);
    const msg = error instanceof Error ? error.message : "Errore interno del server.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
