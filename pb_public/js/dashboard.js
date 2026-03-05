// =====================================================
// TESTIGO — Dashboard
// =====================================================

let dashboardData = { pendientes: [], cumplidos: [], fallidos: [] };
let activeTab = "pendientes";

async function renderDashboard() {
    const user = pb.authStore.record;
    const today = new Date();
    const dateStr = today.toLocaleDateString("es-AR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    app.innerHTML = `
        <div class="dashboard-header">
            <div class="dashboard-header-left">
                <h1>TESTIGO</h1>
                <p class="dashboard-date">${dateStr}</p>
                <p class="dashboard-quote" id="dashboard-quote"></p>
            </div>
            <div class="dashboard-header-right">
                <button onclick="navigate('config')" title="Innegociables">⚙ CONTRATOS</button>
                <button onclick="logout()" title="Salir">SALIR</button>
            </div>
        </div>

        <div class="tab-nav" id="tab-nav">
            <button class="active" data-tab="pendientes">
                DEBERES <span class="tab-count" id="count-pendientes">0</span>
            </button>
            <button data-tab="cumplidos">
                CUMPLIDO <span class="tab-count" id="count-cumplidos">0</span>
            </button>
            <button data-tab="fallidos">
                FALLIDO <span class="tab-count" id="count-fallidos">0</span>
            </button>
        </div>

        <div class="dashboard-columns">
            <div class="tab-content active" id="tab-pendientes">
                <div class="column-header">DEBERES</div>
                <div class="loading">Cargando...</div>
            </div>
            <div class="tab-content" id="tab-cumplidos">
                <div class="column-header">CUMPLIDO</div>
                <div class="loading">Cargando...</div>
            </div>
            <div class="tab-content" id="tab-fallidos">
                <div class="column-header">FALLIDO</div>
                <div class="loading">Cargando...</div>
            </div>
        </div>

        <div class="espejo-section" id="espejo-section">
            <h2>// EL ESPEJO — HISTORIAL DE FRACASOS</h2>
            <div id="espejo-list" class="loading">Cargando...</div>
        </div>
    `;

    // Quote rotation
    const quoteEl = document.getElementById("dashboard-quote");
    startQuoteRotation(quoteEl, 30000);

    // Tab navigation
    setupTabs();

    // Load data
    await loadDashboardData();
    await loadEspejo();
    await checkPunishments();
}

function setupTabs() {
    const tabNav = document.getElementById("tab-nav");
    if (!tabNav) return;

    tabNav.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-tab]");
        if (!btn) return;

        const tab = btn.dataset.tab;
        activeTab = tab;

        // Update active button
        tabNav.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        // Update active content
        document.querySelectorAll(".tab-content").forEach((tc) => tc.classList.remove("active"));
        const target = document.getElementById(`tab-${tab}`);
        if (target) target.classList.add("active");
    });
}

async function loadDashboardData() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    try {
        const records = await pb.collection("registros_diarios").getFullList({
            filter: `user = "${pb.authStore.record.id}" && fecha >= "${todayStart.toISOString()}" && fecha <= "${todayEnd.toISOString()}"`,
            expand: "innegociable",
            sort: "created",
        });

        dashboardData = {
            pendientes: records.filter((r) => r.estado === "pendiente"),
            cumplidos: records.filter((r) => r.estado === "cumplido"),
            fallidos: records.filter((r) => r.estado === "fallido"),
        };

        renderTasks();
    } catch (err) {
        console.error("[TESTIGO] Error loading dashboard:", err);
        document.getElementById("tab-pendientes").innerHTML = `
            <div class="column-header">DEBERES</div>
            <div class="empty-state">Error al cargar las tareas</div>
        `;
    }
}

function renderTasks() {
    renderTaskList("pendientes", dashboardData.pendientes, true);
    renderTaskList("cumplidos", dashboardData.cumplidos, false);
    renderTaskList("fallidos", dashboardData.fallidos, false);

    // Update counts
    const cp = document.getElementById("count-pendientes");
    const cc = document.getElementById("count-cumplidos");
    const cf = document.getElementById("count-fallidos");
    if (cp) cp.textContent = dashboardData.pendientes.length;
    if (cc) cc.textContent = dashboardData.cumplidos.length;
    if (cf) cf.textContent = dashboardData.fallidos.length;
}

function renderTaskList(tabId, records, showActions) {
    const container = document.getElementById(`tab-${tabId}`);
    if (!container) return;

    const titulo = tabId === "pendientes" ? "DEBERES" : tabId === "cumplidos" ? "CUMPLIDO" : "FALLIDO";

    if (records.length === 0) {
        const emptyMsg = tabId === "pendientes"
            ? "No hay tareas pendientes"
            : tabId === "cumplidos"
                ? "Nada cumplido aún"
                : "Sin fallos. Por ahora.";
        container.innerHTML = `
            <div class="column-header">${titulo}</div>
            <div class="empty-state">${emptyMsg}</div>
        `;
        return;
    }

    let html = `<div class="column-header">${titulo}</div><ul class="task-list">`;

    for (const record of records) {
        const taskTitle = record.expand?.innegociable?.titulo || "Tarea";
        const cssClass = tabId === "cumplidos" ? "completed" : tabId === "fallidos" ? "failed" : "";

        html += `<li class="task-item ${cssClass}" data-id="${record.id}">`;
        html += `<div><span class="task-title">${escapeHtml(taskTitle)}</span>`;

        if (tabId === "fallidos" && record.excusa) {
            html += `<div class="task-excusa">"${escapeHtml(record.excusa)}"</div>`;
        }

        html += `</div>`;

        if (showActions) {
            html += `
                <div class="task-action">
                    <button class="btn-done" onclick="markDone('${record.id}')">✓ HECHO</button>
                    <button class="btn-fail" onclick="openExcuseModal('${record.id}', '${escapeHtml(taskTitle)}')">✗ FALLÉ</button>
                </div>
            `;
        }

        html += `</li>`;
    }

    html += `</ul>`;
    container.innerHTML = html;
}

// --- Mark task as Done ---
async function markDone(recordId) {
    try {
        await pb.collection("registros_diarios").update(recordId, { estado: "cumplido" });
        await loadDashboardData();
    } catch (err) {
        console.error("[TESTIGO] Error marking done:", err);
        alert("Error al marcar como cumplido.");
    }
}

// --- Excuse Modal ---
let currentExcuseRecordId = null;

function openExcuseModal(recordId, taskTitle) {
    currentExcuseRecordId = recordId;
    const modal = document.getElementById("excuse-modal");
    const taskNameEl = document.getElementById("excuse-modal-task");
    const textEl = document.getElementById("excuse-text");

    taskNameEl.textContent = `Tarea: ${taskTitle}`;
    textEl.value = "";
    modal.showModal();
}

function closeExcuseModal() {
    const modal = document.getElementById("excuse-modal");
    modal.close();
    currentExcuseRecordId = null;
}

async function submitExcuse() {
    if (!currentExcuseRecordId) return;

    const textEl = document.getElementById("excuse-text");
    const excusa = textEl.value.trim();

    if (!excusa) {
        textEl.style.borderColor = "var(--color-fail)";
        textEl.placeholder = "NO PODÉS DEJAR LA EXCUSA VACÍA.";
        return;
    }

    const btn = document.getElementById("excuse-submit");
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.textContent = "ENVIANDO AL JUEZ...";

    try {
        await pb.collection("registros_diarios").update(currentExcuseRecordId, {
            estado: "fallido",
            excusa: excusa,
        });

        closeExcuseModal();
        await loadDashboardData();
        await loadEspejo();
        await checkPunishments();
    } catch (err) {
        console.error("[TESTIGO] Error submitting excuse:", err);
        alert("Error: " + (err.message || "No se pudo enviar la excusa."));
    } finally {
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
        btn.textContent = "ENVIAR AL JUEZ";
    }
}

// Setup modal event listeners once DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("excuse-cancel").addEventListener("click", closeExcuseModal);
    document.getElementById("excuse-submit").addEventListener("click", submitExcuse);

    // Prevent closing modal with Escape without cancelling properly
    document.getElementById("excuse-modal").addEventListener("cancel", (e) => {
        e.preventDefault();
        closeExcuseModal();
    });
});

// --- El Espejo (Failure History) ---
async function loadEspejo() {
    const espejoList = document.getElementById("espejo-list");
    if (!espejoList) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
        const juicios = await pb.collection("juicios").getFullList({
            filter: `user = "${pb.authStore.record.id}" && created >= "${sevenDaysAgo.toISOString()}"`,
            expand: "registro_diario,registro_diario.innegociable",
            sort: "-created",
        });

        if (juicios.length === 0) {
            espejoList.innerHTML = `<div class="empty-state">Sin fracasos registrados en los últimos 7 días.</div>`;
            return;
        }

        let html = "";
        for (const j of juicios) {
            const fecha = new Date(j.created).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "2-digit",
            });
            const tarea = j.expand?.registro_diario?.expand?.innegociable?.titulo || "Tarea";
            const excusa = j.expand?.registro_diario?.excusa || "—";
            const cumplido = j.castigo_cumplido;

            html += `
                <div class="espejo-entry">
                    <span class="espejo-date">[${fecha}]</span>
                    Fallaste en: <span class="espejo-task">${escapeHtml(tarea)}</span>.
                    Tu excusa: <span class="espejo-excusa">"${escapeHtml(excusa)}"</span>
                    <span class="espejo-veredicto">${escapeHtml(j.veredicto_ia)}</span>
                    ${j.accion_correccion ? `
                        <span class="espejo-correccion">⚡ ${escapeHtml(j.accion_correccion)}</span>
                        ${!cumplido ? `<button class="espejo-cumplido-btn" onclick="markPunishmentDone('${j.id}')">MARCAR CASTIGO CUMPLIDO</button>` : ""}
                    ` : ""}
                </div>
            `;
        }

        espejoList.innerHTML = html;
    } catch (err) {
        console.error("[TESTIGO] Error loading espejo:", err);
        espejoList.innerHTML = `<div class="empty-state">Error al cargar el historial.</div>`;
    }
}

// --- Punishment System ---
async function checkPunishments() {
    const banner = document.getElementById("punishment-banner");
    const bannerText = document.getElementById("punishment-banner-text");
    const blockOverlay = document.getElementById("block-overlay");
    const blockList = document.getElementById("block-overlay-punishments");

    if (!banner || !blockOverlay) return;

    try {
        const pending = await pb.collection("juicios").getFullList({
            filter: `user = "${pb.authStore.record.id}" && castigo_cumplido = false && accion_correccion != ""`,
            sort: "-created",
        });

        if (pending.length === 0) {
            banner.style.display = "none";
            blockOverlay.style.display = "none";
            return;
        }

        if (pending.length === 1) {
            // Banner mode
            bannerText.textContent = `⚠ CASTIGO PENDIENTE: ${pending[0].accion_correccion}`;
            banner.style.display = "flex";
            blockOverlay.style.display = "none";

            document.getElementById("punishment-banner-close").onclick = () => {
                banner.style.display = "none";
            };
        } else {
            // Full block mode (2+ pending)
            banner.style.display = "none";
            blockOverlay.style.display = "flex";

            let html = "";
            for (const p of pending) {
                html += `
                    <div class="block-punishment-item">
                        <span class="punishment-text">⚡ ${escapeHtml(p.accion_correccion)}</span>
                        <button onclick="markPunishmentDone('${p.id}')">MARCAR CUMPLIDO</button>
                    </div>
                `;
            }
            blockList.innerHTML = html;
        }
    } catch (err) {
        console.error("[TESTIGO] Error checking punishments:", err);
    }
}

async function markPunishmentDone(juicioId) {
    try {
        await pb.collection("juicios").update(juicioId, { castigo_cumplido: true });
        await checkPunishments();
        await loadEspejo();
    } catch (err) {
        console.error("[TESTIGO] Error marking punishment done:", err);
        alert("Error al marcar el castigo como cumplido.");
    }
}

// --- Utility ---
function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
