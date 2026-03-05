/// <reference path="../pb_data/types.d.ts" />

// =====================================================
// TESTIGO — Cronjob Matutino (v0.25+)
// Generates daily records at 00:01 for active innegociables
// =====================================================

cronAdd("generate_daily_records", "1 0 * * *", () => {
    console.log("[TESTIGO] Running daily records generation...");

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

    // Get all active innegociables
    let innegociables;
    try {
        innegociables = $app.findRecordsByFilter(
            "innegociables",
            "activo = true",
            "",
            0,
            0,
        );
    } catch (err) {
        console.error("[TESTIGO] Error fetching innegociables:", err);
        return;
    }

    if (!innegociables || innegociables.length === 0) {
        console.log("[TESTIGO] No active innegociables found.");
        return;
    }

    const registrosCol = $app.findCollectionByNameOrId("registros_diarios");
    let created = 0;

    for (const inn of innegociables) {
        // Check if today's day matches frecuencia
        const frecuencia = inn.get("frecuencia");
        if (!frecuencia || !Array.isArray(frecuencia) || !frecuencia.includes(dayOfWeek)) {
            continue;
        }

        const userId = inn.get("user");

        // Check for existing record to avoid duplicates
        try {
            const existing = $app.findRecordsByFilter(
                "registros_diarios",
                "user = {:userId} && innegociable = {:innId} && fecha >= {:start} && fecha <= {:end}",
                "",
                1,
                0,
                { userId: userId, innId: inn.id, start: todayStr + " 00:00:00", end: todayStr + " 23:59:59" },
            );

            if (existing && existing.length > 0) {
                continue;
            }
        } catch (err) {
            // No existing record found, proceed
        }

        // Create the daily record
        try {
            const record = new Record(registrosCol);
            record.set("user", userId);
            record.set("innegociable", inn.id);
            record.set("fecha", todayStr + " 06:00:00.000Z");
            record.set("estado", "pendiente");
            $app.save(record);
            created++;
        } catch (err) {
            console.error(`[TESTIGO] Error creating daily record for innegociable ${inn.id}:`, err);
        }
    }

    console.log(`[TESTIGO] Daily records generated: ${created}`);
});
