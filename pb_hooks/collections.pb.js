/// <reference path="../pb_data/types.d.ts" />

// =====================================================
// TESTIGO — PocketBase Collections Bootstrap (v0.25+)
// Creates/updates collections on app startup
// =====================================================

onBootstrap((e) => {
    // Must call e.next() BEFORE accessing the database
    e.next();

    // Get users collection ID
    const usersCol = $app.findCollectionByNameOrId("users");
    const usersColId = usersCol.id;

    // --- 1. innegociables ---
    let innCol;
    try {
        innCol = $app.findCollectionByNameOrId("innegociables");
    } catch (err) {
        innCol = new Collection({
            type: "base",
            name: "innegociables",
            listRule: "@request.auth.id != '' && @request.auth.id = user",
            viewRule: "@request.auth.id != '' && @request.auth.id = user",
            createRule: "@request.auth.id != ''",
            updateRule: "@request.auth.id != '' && @request.auth.id = user",
            deleteRule: "@request.auth.id != '' && @request.auth.id = user",
            fields: [
                {
                    name: "user",
                    type: "relation",
                    required: true,
                    maxSelect: 1,
                    collectionId: usersColId,
                },
                {
                    name: "titulo",
                    type: "text",
                    required: true,
                },
                {
                    name: "frecuencia",
                    type: "json",
                    required: true,
                },
                {
                    name: "activo",
                    type: "bool",
                },
            ],
        });
        $app.save(innCol);
        console.log('[TESTIGO] Collection "innegociables" created.');
    }

    const innColId = innCol.id;

    // --- 2. registros_diarios ---
    let regCol;
    try {
        regCol = $app.findCollectionByNameOrId("registros_diarios");
    } catch (err) {
        regCol = new Collection({
            type: "base",
            name: "registros_diarios",
            listRule: "@request.auth.id != '' && @request.auth.id = user",
            viewRule: "@request.auth.id != '' && @request.auth.id = user",
            createRule: null,
            updateRule: "@request.auth.id != '' && @request.auth.id = user",
            deleteRule: null,
            fields: [
                {
                    name: "user",
                    type: "relation",
                    required: true,
                    maxSelect: 1,
                    collectionId: usersColId,
                },
                {
                    name: "innegociable",
                    type: "relation",
                    required: true,
                    maxSelect: 1,
                    collectionId: innColId,
                },
                {
                    name: "fecha",
                    type: "date",
                    required: true,
                },
                {
                    name: "estado",
                    type: "select",
                    required: true,
                    values: ["pendiente", "cumplido", "fallido"],
                },
                {
                    name: "excusa",
                    type: "text",
                    required: false,
                },
            ],
        });
        $app.save(regCol);
        console.log('[TESTIGO] Collection "registros_diarios" created.');
    }

    const regColId = regCol.id;

    // --- 3. juicios ---
    try {
        $app.findCollectionByNameOrId("juicios");
    } catch (err) {
        let collection = new Collection({
            type: "base",
            name: "juicios",
            listRule: "@request.auth.id != '' && @request.auth.id = user",
            viewRule: "@request.auth.id != '' && @request.auth.id = user",
            createRule: null,
            updateRule: "@request.auth.id != '' && @request.auth.id = user",
            deleteRule: null,
            fields: [
                {
                    name: "user",
                    type: "relation",
                    required: true,
                    maxSelect: 1,
                    collectionId: usersColId,
                },
                {
                    name: "registro_diario",
                    type: "relation",
                    required: true,
                    maxSelect: 1,
                    collectionId: regColId,
                },
                {
                    name: "veredicto_ia",
                    type: "text",
                    required: true,
                },
                {
                    name: "accion_correccion",
                    type: "text",
                    required: false,
                },
                {
                    name: "castigo_cumplido",
                    type: "bool",
                },
            ],
        });
        $app.save(collection);
        console.log('[TESTIGO] Collection "juicios" created.');
    }

    // --- 4. Extend users collection ---
    try {
        let needsSave = false;

        if (!usersCol.fields.getByName("alias")) {
            usersCol.fields.add(new TextField({ name: "alias", required: false }));
            needsSave = true;
        }

        if (!usersCol.fields.getByName("approved")) {
            usersCol.fields.add(new BoolField({ name: "approved" }));
            needsSave = true;
        }

        // Disable password authentication and ensure OTP/OAuth are enabled
        if (usersCol.passwordAuth.enabled !== false) {
            usersCol.passwordAuth.enabled = false;
            needsSave = true;
        }
        if (usersCol.otp.enabled !== true) {
            usersCol.otp.enabled = true;
            needsSave = true;
        }
        if (usersCol.oauth2.enabled !== true) {
            usersCol.oauth2.enabled = true;
            needsSave = true;
        }

        if (needsSave) {
            $app.save(usersCol);
            console.log('[TESTIGO] Users collection updated with "alias", "approved", and Auth settings.');
        }
    } catch (err) {
        console.error("[TESTIGO] Error updating users collection:", err);
    }
});
