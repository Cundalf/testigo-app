import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testigoApp } from './app.js';

// --- Mocks Globales ---
global.alert = vi.fn();
global.confirm = () => true;
global.scrollTo = vi.fn();

// Mock de PocketBase que mantiene consistencia en las colecciones
const createPBMock = () => {
    const collections = {};
    const getCollection = (name) => {
        if (!collections[name]) {
            collections[name] = {
                requestOTP: vi.fn().mockResolvedValue({ otpId: 'otp-123' }),
                authWithOTP: vi.fn().mockResolvedValue({}),
                authWithOAuth2: vi.fn().mockResolvedValue({}),
                getFullList: vi.fn().mockResolvedValue([]),
                update: vi.fn().mockResolvedValue({}),
                create: vi.fn().mockResolvedValue({}),
                delete: vi.fn().mockResolvedValue({}),
                getOne: vi.fn().mockResolvedValue({}),
            };
        }
        return collections[name];
    };

    return {
        collection: vi.fn((name) => getCollection(name)),
        authStore: {
            isValid: false,
            record: { id: 'user123' },
            clear: vi.fn(),
        }
    };
};

describe('Testigo Core Logic - Cobertura Total', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = testigoApp();
        app.pb = createPBMock();

        // Simular window.location.hash
        // Usamos una variable interna para simular el comportamiento real del hash
        let hashValue = '';
        delete window.location;
        window.location = {
            get hash() { return hashValue; },
            set hash(v) { hashValue = (v.startsWith('#') ? v : '#' + v); },
            origin: 'http://localhost'
        };
    });

    describe('Navegación y Guards', () => {
        it('redirige a login si intenta ir a dashboard sin estar autenticado', () => {
            window.location.hash = '#dashboard';
            app.pb.authStore.isValid = false;
            app.syncRouteFromHash();
            expect(window.location.hash).toBe('#login');
        });

        it('redirige a dashboard si intenta ir a login estando ya autenticado', () => {
            window.location.hash = '#login';
            app.pb.authStore.isValid = true;
            app.syncRouteFromHash();
            expect(window.location.hash).toBe('#dashboard');
        });

        it('establece la ruta correcta si está autenticado', () => {
            window.location.hash = '#config';
            app.pb.authStore.isValid = true;
            app.syncRouteFromHash();
            expect(app.route).toBe('config');
        });
    });

    describe('Autenticación (OTP)', () => {
        it('maneja el flujo de envío de email exitoso', async () => {
            app.loginEmail = 'test@test.com';
            const c = app.pb.collection('users');

            await app.handleEmailSubmit();

            expect(c.requestOTP).toHaveBeenCalledWith('test@test.com');
            expect(app.loginStep).toBe('otp');
            expect(app.otpId).toBe('otp-123');
        });

        it('maneja errores de email mostrando el mismo mensaje (seguridad)', async () => {
            app.loginEmail = 'malvado@test.com';
            const c = app.pb.collection('users');
            c.requestOTP.mockRejectedValue(new Error('User not found'));

            await app.handleEmailSubmit();

            expect(app.loginStep).toBe('otp');
            expect(app.loginMessageType).toBe('success');
        });

        it('maneja verificación de OTP exitosa', async () => {
            app.otpId = 'otp-123';
            app.loginOtp = '123456';
            const c = app.pb.collection('users');

            await app.handleOtpSubmit();

            expect(c.authWithOTP).toHaveBeenCalledWith('otp-123', '123456');
            expect(window.location.hash).toBe('#dashboard');
        });

        it('maneja error en verificación de OTP', async () => {
            app.otpId = 'otp-123';
            app.loginOtp = 'incorrecto';
            const c = app.pb.collection('users');
            c.authWithOTP.mockRejectedValue(new Error('Invalid OTP'));

            await app.handleOtpSubmit();

            expect(app.loginMessageType).toBe('error');
            expect(app.loginMessage).toContain('inválido');
        });

        it('maneja login con Google OAuth exitoso', async () => {
            const c = app.pb.collection('users');

            await app.handleGoogleLogin();

            expect(c.authWithOAuth2).toHaveBeenCalledWith({ provider: 'google' });
            expect(window.location.hash).toBe('#dashboard');
        });

        it('maneja error en login con Google OAuth', async () => {
            const c = app.pb.collection('users');
            c.authWithOAuth2.mockRejectedValue(new Error('OAuth error'));

            await app.handleGoogleLogin();

            expect(app.loginMessageType).toBe('error');
            expect(app.loginMessage).toContain('Error al iniciar sesión');
        });
    });

    describe('Gestión de Tareas y Dashboard', () => {
        it('carga y filtra registros diarios correctamente', async () => {
            const mockRecords = [
                { id: '1', estado: 'pendiente' },
                { id: '2', estado: 'cumplido' },
                { id: '3', estado: 'fallido' },
                { id: '4', estado: 'pendiente' },
            ];
            const c = app.pb.collection('registros_diarios');
            c.getFullList.mockResolvedValue(mockRecords);

            await app.loadDashboardData();

            expect(app.dashboardData.pendientes).toHaveLength(2);
            expect(app.dashboardData.cumplidos).toHaveLength(1);
            expect(app.dashboardData.fallidos).toHaveLength(1);
        });

        it('marca una tarea como cumplida y recarga', async () => {
            const c = app.pb.collection('registros_diarios');
            const loadSpy = vi.spyOn(app, 'loadDashboardData');

            await app.markDone('rec-1');

            expect(c.update).toHaveBeenCalledWith('rec-1', { estado: 'cumplido' });
            expect(loadSpy).toHaveBeenCalled();
        });
    });

    describe('Sistema de Excusas y Castigos', () => {
        it('no permite enviar una excusa vacía', async () => {
            app.excuseModal = { open: true, text: '   ', recordId: 'r1' };
            await app.submitExcuse();
            expect(app.excuseModal.error).toBe(true);
        });

        it('procesa el envío de excusa y actualiza todo el sistema', async () => {
            app.excuseModal = { open: true, text: 'Me dio paja', recordId: 'r1', taskTitle: 'Test' };
            const c = app.pb.collection('registros_diarios');
            const checkPunishmentsSpy = vi.spyOn(app, 'checkPunishments');

            await app.submitExcuse();

            expect(c.update).toHaveBeenCalledWith('r1', { estado: 'fallido', excusa: 'Me dio paja' });
            expect(app.excuseModal.open).toBe(false);
            expect(checkPunishmentsSpy).toHaveBeenCalled();
        });

        it('detecta modo banner (1 castigo)', async () => {
            const c = app.pb.collection('juicios');
            c.getFullList.mockResolvedValue([
                { id: 'j1', accion_correccion: '10 burpees' }
            ]);
            await app.checkPunishments();
            expect(app.pendingPunishments).toHaveLength(1);
            expect(app.bannerClosed).toBe(false);
        });

        it('detecta modo bloqueo (2+ castigos)', async () => {
            const c = app.pb.collection('juicios');
            c.getFullList.mockResolvedValue([
                { id: 'j1', accion_correccion: 'Castigo A' },
                { id: 'j2', accion_correccion: 'Castigo B' }
            ]);
            await app.checkPunishments();
            expect(app.pendingPunishments).toHaveLength(2);
        });
    });

    describe('Configuración de Innegociables', () => {
        it('valida campos obligatorios al guardar', async () => {
            app.innForm = { titulo: '', frecuencia: [1] };
            await app.saveInnegociable();
            expect(app.innForm.error).toBe(true);
        });

        it('crea un nuevo innegociable correctamente', async () => {
            app.innForm = { titulo: 'Leer', frecuencia: [1, 2] };
            const c = app.pb.collection('innegociables');

            await app.saveInnegociable();

            expect(c.create).toHaveBeenCalledWith(expect.objectContaining({
                titulo: 'Leer',
                frecuencia: [1, 2]
            }));
        });

        it('elimina un innegociable tras confirmar', async () => {
            const c = app.pb.collection('innegociables');
            await app.deleteInnegociable('inn-1');
            expect(c.delete).toHaveBeenCalledWith('inn-1');
        });
    });

    describe('Visualización y Fechas', () => {
        it('formatea fechas de forma amigable', () => {
            const date = '2024-03-05T12:00:00Z';
            const formatted = app.formatMiniDate(date);
            expect(formatted).toMatch(/5/);
            expect(formatted).toMatch(/3/);
        });

        it('formatea la frecuencia de días correctamente', () => {
            expect(app.formatFreq([1, 2, 3])).toBe('Lun, Mar, Mié');
            expect(app.formatFreq([0, 6])).toBe('Dom, Sáb');
        });
    });
});

import { STOIC_QUOTES } from './quotes.js';

describe('Quotes Module', () => {
    it('should have an array of quotes', () => {
        expect(Array.isArray(STOIC_QUOTES)).toBe(true);
        expect(STOIC_QUOTES.length).toBeGreaterThan(0);
    });

    it('each quote should have text and author', () => {
        STOIC_QUOTES.forEach(quote => {
            expect(quote).toHaveProperty('text');
            expect(quote).toHaveProperty('author');
            expect(typeof quote.text).toBe('string');
            expect(typeof quote.author).toBe('string');
        });
    });
});
