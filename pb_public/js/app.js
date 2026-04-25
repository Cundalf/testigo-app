// =====================================================
// TESTIGO — Main App (Alpine.js)
// =====================================================

import { STOIC_QUOTES } from './quotes.js';

// En el navegador, PocketBase es global. En tests, lo inyectamos o simulamos.
const pbCheck = typeof PocketBase !== 'undefined' ? new PocketBase(window.location.origin) : null;

export const testigoApp = () => ({
    // --- State ---
    route: 'landing',
    get pb() { return this._mockPb || pbCheck; },
    set pb(v) { this._mockPb = v; },
    loading: false,

    // Auth
    loginStep: 'email', // email -> otp
    loginEmail: '',
    loginOtp: '',
    otpId: null,
    loginMessage: '',
    loginMessageType: '',

    // Dashboard
    activeTab: 'pendientes',
    loadingData: false,
    dashboardData: { pendientes: [], cumplidos: [], fallidos: [] },
    juicios: [],
    loadingEspejo: false,
    pendingPunishments: [],
    bannerClosed: false,

    // Config
    loadingConfig: false,
    savingConfig: false,
    innegociables: [],
    dayNames: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
    innForm: {
        id: '',
        titulo: '',
        frecuencia: [],
        error: false
    },

    // Modals
    excuseModal: {
        open: false,
        recordId: null,
        taskTitle: '',
        text: '',
        error: false,
        submitting: false
    },

    // Quotes
    currentQuote: '',
    quoteInterval: null,
    todayDateStr: '',

    // --- Init ---
    init() {
        // Hash router sync
        this.syncRouteFromHash();
        window.addEventListener('hashchange', () => this.syncRouteFromHash());

        // Today's date
        const today = new Date();
        this.todayDateStr = today.toLocaleDateString("es-AR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });

        // Start quote rotation
        this.startQuoteRotation();
    },

    // --- Routing ---
    syncRouteFromHash() {
        const hash = window.location.hash.replace('#', '') || 'landing';

        // Auth Guard
        if (['dashboard', 'config'].includes(hash) && !this.pb?.authStore?.isValid) {
            this.navigate('login');
            return;
        }
        if (['landing', 'login'].includes(hash) && this.pb?.authStore?.isValid) {
            this.navigate('dashboard');
            return;
        }

        this.route = hash;
        this.onRouteEnter(hash);
    },

    navigate(hash) {
        window.location.hash = hash;
    },

    async onRouteEnter(route) {
        if (route === 'dashboard') {
            await this.loadDashboardData();
            await this.loadEspejo();
            await this.checkPunishments();
        } else if (route === 'config') {
            await this.loadInnegociables();
        }
    },

    // --- Auth methods ---
    async handleGoogleLogin() {
        this.loading = true;
        this.loginMessage = '';
        try {
            await this.pb.collection("users").authWithOAuth2({ provider: "google" });
            this.navigate('dashboard');
        } catch (err) {
            console.error(err);
            this.loginMessage = "Error al iniciar sesión con Google.";
            this.loginMessageType = "error";
        } finally {
            this.loading = false;
        }
    },

    async handleEmailSubmit() {
        if (!this.loginEmail) return;
        this.loading = true;
        this.loginMessage = '';

        try {
            const result = await this.pb.collection("users").requestOTP(this.loginEmail);
            this.otpId = result.otpId;
            this.loginStep = 'otp';
            this.loginMessage = "Si el email está registrado, recibirás un código OTP.";
            this.loginMessageType = "success";
        } catch (err) {
            this.loginStep = 'otp';
            this.loginMessage = "Si el email está registrado, recibirás un código OTP.";
            this.loginMessageType = "success";
        } finally {
            this.loading = false;
        }
    },

    async handleOtpSubmit() {
        if (!this.loginOtp) return;
        this.loading = true;

        try {
            await this.pb.collection("users").authWithOTP(this.otpId, this.loginOtp);
            this.navigate('dashboard');
        } catch (err) {
            this.loginMessage = "Código inválido o expirado. Intentá de nuevo.";
            this.loginMessageType = "error";
        } finally {
            this.loading = false;
        }
    },

    logout() {
        this.pb.authStore.clear();
        this.navigate('landing');
    },

    // --- Dashboard methods ---
    async loadDashboardData() {
        this.loadingData = true;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        try {
            const records = await this.pb.collection("registros_diarios").getFullList({
                filter: `user = "${this.pb.authStore.record.id}" && fecha >= "${todayStart.toISOString()}" && fecha <= "${todayEnd.toISOString()}"`,
                expand: "innegociable",
                sort: "created",
            });

            this.dashboardData = {
                pendientes: records.filter((r) => r.estado === "pendiente"),
                cumplidos: records.filter((r) => r.estado === "cumplido"),
                fallidos: records.filter((r) => r.estado === "fallido"),
            };
        } catch (err) {
            console.error("[TESTIGO] Error loading dashboard:", err);
        } finally {
            this.loadingData = false;
        }
    },

    async markDone(recordId) {
        try {
            await this.pb.collection("registros_diarios").update(recordId, { estado: "cumplido" });
            await this.loadDashboardData();
        } catch (err) {
            alert("Error al marcar como cumplido.");
        }
    },

    openExcuseModal(recordId, taskTitle) {
        this.excuseModal = {
            open: true,
            recordId: recordId,
            taskTitle: taskTitle,
            text: '',
            error: false,
            submitting: false
        };
    },

    closeExcuseModal() {
        this.excuseModal.open = false;
    },

    async submitExcuse() {
        if (!this.excuseModal.text.trim()) {
            this.excuseModal.error = true;
            return;
        }

        this.excuseModal.submitting = true;
        try {
            await this.pb.collection("registros_diarios").update(this.excuseModal.recordId, {
                estado: "fallido",
                excusa: this.excuseModal.text,
            });

            this.closeExcuseModal();
            await this.loadDashboardData();
            await this.loadEspejo();
            await this.checkPunishments();
        } catch (err) {
            alert("Error: " + (err.message || "No se pudo enviar la excusa."));
        } finally {
            this.excuseModal.submitting = false;
        }
    },

    async loadEspejo() {
        this.loadingEspejo = true;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        try {
            this.juicios = await this.pb.collection("juicios").getFullList({
                filter: `user = "${this.pb.authStore.record.id}" && created >= "${sevenDaysAgo.toISOString()}"`,
                expand: "registro_diario,registro_diario.innegociable",
                sort: "-created",
            });
        } catch (err) {
            console.error("[TESTIGO] Error loading espejo:", err);
        } finally {
            this.loadingEspejo = false;
        }
    },

    async checkPunishments() {
        try {
            this.pendingPunishments = await this.pb.collection("juicios").getFullList({
                filter: `user = "${this.pb.authStore.record.id}" && castigo_cumplido = false && accion_correccion != ""`,
                sort: "-created",
            });
            this.bannerClosed = false;
        } catch (err) {
            console.error("[TESTIGO] Error checking punishments:", err);
        }
    },

    async markPunishmentDone(juicioId) {
        try {
            await this.pb.collection("juicios").update(juicioId, { castigo_cumplido: true });
            await this.checkPunishments();
            await this.loadEspejo();
        } catch (err) {
            alert("Error al marcar el castigo como cumplido.");
        }
    },

    // --- Config methods ---
    async loadInnegociables() {
        this.loadingConfig = true;
        try {
            this.innegociables = await this.pb.collection("innegociables").getFullList({
                filter: `user = "${this.pb.authStore.record.id}"`,
                sort: "-created",
            });
        } catch (err) {
            console.error("[TESTIGO] Error loading innegociables:", err);
        } finally {
            this.loadingConfig = false;
        }
    },

    async saveInnegociable() {
        if (!this.innForm.titulo.trim()) {
            this.innForm.error = true;
            return;
        }
        if (this.innForm.frecuencia.length === 0) {
            alert("Seleccioná al menos un día.");
            return;
        }

        this.savingConfig = true;
        try {
            const data = {
                user: this.pb.authStore.record.id,
                titulo: this.innForm.titulo,
                frecuencia: this.innForm.frecuencia.map(Number),
                activo: true,
            };

            if (this.innForm.id) {
                await this.pb.collection("innegociables").update(this.innForm.id, data);
            } else {
                await this.pb.collection("innegociables").create(data);
            }

            this.resetInnForm();
            await this.loadInnegociables();
        } catch (err) {
            alert("Error al guardar: " + (err.message || "Error desconocido"));
        } finally {
            this.savingConfig = false;
        }
    },

    editInnegociable(item) {
        this.innForm = {
            id: item.id,
            titulo: item.titulo,
            frecuencia: item.frecuencia.map(String),
            error: false
        };
        document.getElementById("inn-form")?.scrollIntoView({ behavior: "smooth" });
    },

    async toggleInnegociable(item) {
        try {
            await this.pb.collection("innegociables").update(item.id, { activo: !item.activo });
            await this.loadInnegociables();
        } catch (err) {
            console.error("[TESTIGO] Error toggling innegociable:", err);
        }
    },

    async deleteInnegociable(id) {
        if (!confirm("¿Eliminar este contrato? Esta acción es irreversible.")) return;
        try {
            await this.pb.collection("innegociables").delete(id);
            await this.loadInnegociables();
        } catch (err) {
            alert("Error al eliminar.");
        }
    },

    resetInnForm() {
        this.innForm = { id: '', titulo: '', frecuencia: [], error: false };
    },

    // --- Utils & Helpers ---
    formatMiniDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
    },

    formatFreq(freq) {
        if (!freq) return '';
        return freq.map(d => this.dayNames[d]).join(', ');
    },

    startQuoteRotation() {
        const setQuote = () => {
            const quote = STOIC_QUOTES[Math.floor(Math.random() * STOIC_QUOTES.length)];
            this.currentQuote = `"${quote.text}" — ${quote.author}`;
        };

        setQuote();
        if (this.quoteInterval) clearInterval(this.quoteInterval);
        this.quoteInterval = setInterval(setQuote, 30000);
    }
});

// Exponer globalmente para Alpine cuando app.js es un módulo
if (typeof window !== 'undefined') {
    window.testigoApp = testigoApp;
}

// Registrar en Alpine si estamos en el navegador
if (typeof document !== 'undefined') {
    document.addEventListener('alpine:init', () => {
        if (typeof Alpine !== 'undefined') {
            Alpine.data('testigoApp', testigoApp);
        }
    });
}
