/// <reference path="../pb_data/types.d.ts" />

// =====================================================
// TESTIGO — El Juicio Estoico (v0.25+)
// Triggers Gemini AI when a task is marked as "fallido"
// =====================================================

const SYSTEM_PROMPT = `Eres un Maestro Estoico implacable y un juez de la disciplina. Tu objetivo no es ser amable, compasivo, ni servicial. Tu objetivo es destruir las excusas, el victimismo y la debilidad del usuario mediante la lógica fría y la rendición de cuentas.

Se te proporcionará:
1. Las tareas que el usuario debía cumplir hoy (Su contrato).
2. Lo que efectivamente cumplió.
3. La tarea en la que falló.
4. La excusa que escribió justificando su fallo.

TUS REGLAS DE RESPUESTA:
- Responde siempre en un solo párrafo, máximo 4 oraciones cortas.
- Habla en segunda persona del singular ("tú", "fallaste", "elegiste").
- Sé cortante, directo y carente de emoción.
- Analiza la excusa: Si detectas que se justifica con emociones ("estaba triste", "no tenía ganas", "me sentí vulnerable") o cansancio leve, ataca directamente esa debilidad emocional.
- Diferencia entre un motivo de fuerza mayor real (ej: "tuve un accidente de tránsito") y una falta de carácter (ej: "llovía y no fui al gimnasio").
- Si la excusa es falta de carácter, termina tu respuesta asignando una "Acción de corrección" breve y punitiva para el día siguiente (Ej: "Acción de corrección: 24 horas sin consumo de redes sociales." o "Acción de corrección: Ayuno de 16 horas.").
- NUNCA uses saludos ("Hola", "Entiendo que..."). Ve directo a la sentencia.
- NO ofrezcas consejos motivacionales ni tips de productividad. Juzga el acto, dicta la sentencia.`;

onRecordUpdateRequest((e) => {
    const record = e.record;
    const originalEstado = record.original().get("estado");
    const newEstado = record.get("estado");

    // Only trigger when changing TO "fallido"
    if (newEstado !== "fallido" || originalEstado === "fallido") {
        e.next();
        return;
    }

    // Validate excusa is not empty
    const excusa = (record.get("excusa") || "").trim();
    if (!excusa) {
        throw new BadRequestError("Debes escribir una excusa para marcar la tarea como fallida.");
    }

    // Continue with the update first
    e.next();

    // --- Build AI context ---
    const userId = record.get("user");
    const fecha = record.get("fecha");
    const fechaStr = fecha ? String(fecha).split(" ")[0] : new Date().toISOString().split("T")[0];

    // Get all daily records for this user today
    let todayRecords = [];
    try {
        todayRecords = $app.findRecordsByFilter(
            "registros_diarios",
            "user = {:userId} && fecha >= {:start} && fecha <= {:end}",
            "",
            0,
            0,
            { userId: userId, start: fechaStr + " 00:00:00", end: fechaStr + " 23:59:59" },
        );
    } catch (err) {
        console.error("[TESTIGO] Error fetching today's records:", err);
    }

    // Resolve innegociable names
    const deberes = [];
    const cumplidos = [];
    let tareaFallidaNombre = "Tarea desconocida";

    for (const rec of todayRecords) {
        let titulo = "Tarea";
        try {
            const inn = $app.findRecordById("innegociables", rec.get("innegociable"));
            titulo = inn.get("titulo");
        } catch (err) {
            // ignore
        }

        deberes.push(titulo);

        if (rec.get("estado") === "cumplido") {
            cumplidos.push(titulo);
        }
        if (rec.id === record.id) {
            tareaFallidaNombre = titulo;
        }
    }

    // Build message for AI
    const userMessage = `CONTRATO DEL DÍA (tareas que debía cumplir): ${deberes.join(", ")}
TAREAS CUMPLIDAS: ${cumplidos.length > 0 ? cumplidos.join(", ") : "Ninguna"}
TAREA FALLIDA: ${tareaFallidaNombre}
EXCUSA: "${excusa}"`;

    // Get API key from environment
    const apiKey = $os.getenv("GEMINI_API_KEY");

    if (!apiKey || apiKey === "tu_api_key_aqui") {
        console.error("[TESTIGO] GEMINI_API_KEY not set. Saving fallback judgment.");
        try {
            const juiciosCol = $app.findCollectionByNameOrId("juicios");
            const juicio = new Record(juiciosCol);
            juicio.set("user", userId);
            juicio.set("registro_diario", record.id);
            juicio.set("veredicto_ia", "El sistema de juicio no está disponible. Tu fallo queda registrado sin veredicto. Configurá la API key de Gemini.");
            juicio.set("accion_correccion", "");
            juicio.set("castigo_cumplido", false);
            $app.save(juicio);
        } catch (err) {
            console.error("[TESTIGO] Error saving fallback judgment:", err);
        }
        return;
    }

    try {
        const res = $http.send({
            url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: SYSTEM_PROMPT }],
                },
                contents: [
                    {
                        parts: [{ text: userMessage }],
                    },
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 300,
                },
            }),
            timeout: 30,
        });

        let veredicto = "";
        let accionCorreccion = "";

        if (res.statusCode === 200) {
            const data = res.json;
            veredicto = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta del juez.";

            // Extract "Acción de corrección" if present
            const match = veredicto.match(/Acción de corrección:\s*(.+?)(?:\.|$)/i);
            if (match) {
                accionCorreccion = match[1].trim();
                // Remove trailing dot if present
                if (accionCorreccion.endsWith(".")) {
                    accionCorreccion = accionCorreccion.slice(0, -1);
                }
            }
        } else {
            console.error("[TESTIGO] Gemini API error:", res.statusCode, res.raw);
            veredicto = "El juez no ha podido emitir su veredicto. Tu fallo queda registrado.";
        }

        // Save the judgment
        const juiciosCol = $app.findCollectionByNameOrId("juicios");
        const juicio = new Record(juiciosCol);
        juicio.set("user", userId);
        juicio.set("registro_diario", record.id);
        juicio.set("veredicto_ia", veredicto);
        juicio.set("accion_correccion", accionCorreccion);
        juicio.set("castigo_cumplido", false);
        $app.save(juicio);

        console.log("[TESTIGO] Judgment saved for record " + record.id);
    } catch (err) {
        console.error("[TESTIGO] Error calling Gemini API:", err);
    }
}, "registros_diarios");
