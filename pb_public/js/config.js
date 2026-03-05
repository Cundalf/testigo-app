// =====================================================
// TESTIGO — Config Page (Innegociables CRUD)
// =====================================================

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

async function renderConfig() {
    app.innerHTML = `
        <div class="config-container">
            <h1>// CONTRATOS</h1>
            <p class="config-sub">Definí tus innegociables. Lo que prometés, se cumple.</p>

            <div id="innegociables-list" class="loading">Cargando...</div>

            <div class="innegociable-form" id="inn-form">
                <h3 id="inn-form-title">// NUEVO CONTRATO</h3>
                <input type="hidden" id="inn-edit-id" value="">
                <label for="inn-titulo">Título</label>
                <input type="text" id="inn-titulo" placeholder='Ej: "Trabajo Profundo (4hs)"' required>
                <label>Días de la semana</label>
                <div class="day-selector" id="inn-days">
                    ${DAY_NAMES.map((name, i) => `
                        <label>
                            <input type="checkbox" value="${i}">
                            ${name}
                        </label>
                    `).join("")}
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button id="inn-save-btn" onclick="saveInnegociable()">GUARDAR</button>
                    <button class="secondary" id="inn-cancel-btn" onclick="resetForm()" style="display:none;">CANCELAR</button>
                </div>
            </div>

            <div class="config-back">
                <a href="#dashboard">← Volver al tablero</a>
            </div>
        </div>
    `;

    await loadInnegociables();
}

async function loadInnegociables() {
    const list = document.getElementById("innegociables-list");
    if (!list) return;

    try {
        const records = await pb.collection("innegociables").getFullList({
            filter: `user = "${pb.authStore.record.id}"`,
            sort: "-created",
        });

        if (records.length === 0) {
            list.innerHTML = `<div class="empty-state">No tenés contratos definidos. Creá el primero.</div>`;
            return;
        }

        let html = "";
        for (const r of records) {
            const freq = r.frecuencia || [];
            const daysStr = freq.map((d) => DAY_NAMES[d] || "?").join(", ");
            const activo = r.activo !== false;

            html += `
                <div class="innegociable-item" style="${activo ? "" : "opacity:0.4;"}">
                    <div class="inn-info">
                        <div class="inn-title">${escapeHtml(r.titulo)}</div>
                        <div class="inn-days">${daysStr} ${activo ? "" : "— INACTIVO"}</div>
                    </div>
                    <div class="inn-actions">
                        <button onclick="editInnegociable('${r.id}')">${activo ? "EDITAR" : "EDITAR"}</button>
                        <button onclick="toggleInnegociable('${r.id}', ${activo})">${activo ? "PAUSAR" : "ACTIVAR"}</button>
                        <button onclick="deleteInnegociable('${r.id}')" style="color:var(--color-fail);">BORRAR</button>
                    </div>
                </div>
            `;
        }

        list.innerHTML = html;
    } catch (err) {
        console.error("[TESTIGO] Error loading innegociables:", err);
        list.innerHTML = `<div class="empty-state">Error al cargar los contratos.</div>`;
    }
}

async function saveInnegociable() {
    const editId = document.getElementById("inn-edit-id").value;
    const titulo = document.getElementById("inn-titulo").value.trim();
    const checkboxes = document.querySelectorAll("#inn-days input[type='checkbox']:checked");
    const frecuencia = Array.from(checkboxes).map((cb) => parseInt(cb.value));

    if (!titulo) {
        document.getElementById("inn-titulo").style.borderColor = "var(--color-fail)";
        return;
    }
    if (frecuencia.length === 0) {
        alert("Seleccioná al menos un día.");
        return;
    }

    const btn = document.getElementById("inn-save-btn");
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");

    try {
        const data = {
            user: pb.authStore.record.id,
            titulo,
            frecuencia,
            activo: true,
        };

        if (editId) {
            await pb.collection("innegociables").update(editId, data);
        } else {
            await pb.collection("innegociables").create(data);
        }

        resetForm();
        await loadInnegociables();
    } catch (err) {
        console.error("[TESTIGO] Error saving innegociable:", err);
        alert("Error al guardar: " + (err.message || "Error desconocido"));
    } finally {
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
    }
}

async function editInnegociable(id) {
    try {
        const record = await pb.collection("innegociables").getOne(id);

        document.getElementById("inn-edit-id").value = id;
        document.getElementById("inn-titulo").value = record.titulo;
        document.getElementById("inn-form-title").textContent = "// EDITAR CONTRATO";
        document.getElementById("inn-cancel-btn").style.display = "inline-block";

        // Set checkboxes
        const checkboxes = document.querySelectorAll("#inn-days input[type='checkbox']");
        const freq = record.frecuencia || [];
        checkboxes.forEach((cb) => {
            cb.checked = freq.includes(parseInt(cb.value));
        });

        // Scroll to form
        document.getElementById("inn-form").scrollIntoView({ behavior: "smooth" });
    } catch (err) {
        console.error("[TESTIGO] Error loading innegociable:", err);
    }
}

async function toggleInnegociable(id, currentState) {
    try {
        await pb.collection("innegociables").update(id, { activo: !currentState });
        await loadInnegociables();
    } catch (err) {
        console.error("[TESTIGO] Error toggling innegociable:", err);
    }
}

async function deleteInnegociable(id) {
    if (!confirm("¿Eliminar este contrato? Esta acción es irreversible.")) return;

    try {
        await pb.collection("innegociables").delete(id);
        await loadInnegociables();
    } catch (err) {
        console.error("[TESTIGO] Error deleting innegociable:", err);
        alert("Error al eliminar.");
    }
}

function resetForm() {
    document.getElementById("inn-edit-id").value = "";
    document.getElementById("inn-titulo").value = "";
    document.getElementById("inn-form-title").textContent = "// NUEVO CONTRATO";
    document.getElementById("inn-cancel-btn").style.display = "none";

    const checkboxes = document.querySelectorAll("#inn-days input[type='checkbox']");
    checkboxes.forEach((cb) => (cb.checked = false));
}
