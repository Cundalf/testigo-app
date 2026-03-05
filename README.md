# TESTIGO

**La app de productividad que no te perdona.**

Una herramienta de rendición de cuentas brutalista. Definís tus compromisos diarios, y si fallás, un Maestro Estoico (Gemini AI) juzga tus excusas y asigna castigos.

> Sin rachas. Sin badges. Sin motivación barata.

---

## Stack

| Componente | Tecnología |
|---|---|
| Backend, DB, Auth | [PocketBase](https://pocketbase.io) v0.25+ |
| Frontend | Alpine.js + Pico CSS v2 |
| Motor IA | Google Gemini (via API) |
| Deploy | Docker |

## Características

- **Innegociables**: Definís hábitos/contratos con días de la semana
- **Generación automática**: Cron diario a las 00:01 crea las tareas pendientes
- **Juicio estoico**: Al marcar una tarea como fallida, debés escribir una excusa. Gemini la evalúa con frialdad estoica y asigna castigos
- **Bloqueo progresivo**: 1 castigo pendiente = banner de advertencia. 2+ = modo bloqueo total
- **El Espejo**: Historial de fracasos de los últimos 7 días
- **Aprobación de usuarios**: El admin debe aprobar cada usuario antes de que pueda recibir OTPs
- **Frases estoicas**: Rotación automática de citas de Marco Aurelio, Séneca y Epicteto

## Inicio Rápido

### 1. Clonar y configurar

```bash
git clone <tu-repo>
cd testigo-app
cp .env.example .env
```

Editá `.env` y agregá tu API key de [Google AI Studio](https://aistudio.google.com/):

```
GEMINI_API_KEY=tu_api_key_real
```

### 2. Levantar con Docker

```bash
docker build -t testigo-app .
docker run -d --name testigo-app -p 8090:8090 --env-file .env testigo-app
```

O con Docker Compose:

```bash
docker compose up -d --build
```

### 3. Setup inicial

1. Abrí `http://localhost:8090/_/` → creá tu superuser admin
2. **Configurar SMTP**: Admin → Settings → Mail (necesario para enviar OTPs)
3. **Crear tu usuario**: Admin → users → nuevo → completá email, alias y marcá `approved = true`
4. **Loguearte**: `http://localhost:8090` → ENTRAR → email → OTP → dashboard

## Estructura

```
testigo-app/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── pb_hooks/
│   ├── collections.pb.js      # Auto-crea colecciones al arrancar
│   ├── admin_approval.pb.js   # Bloquea OTP para users no aprobados
│   ├── cron_daily.pb.js       # Genera tareas diarias a las 00:01
│   └── stoic_judge.pb.js      # Juicio de Gemini AI al fallar
└── pb_public/
    ├── index.html             # UI Templates (Alpine.js)
    ├── css/style.css
    └── js/
        ├── app.js             # Lógica centralizada (Alpine component)
        └── quotes.js          # Datos de frases estoicas
```

## Colecciones (auto-generadas)

| Colección | Propósito |
|---|---|
| `users` | Auth + campos `alias`, `approved` |
| `innegociables` | Hábitos/contratos con frecuencia semanal |
| `registros_diarios` | Instancias diarias (pendiente/cumplido/fallido) |
| `juicios` | Veredictos de la IA + acciones de corrección |

## Comandos Útiles

```bash
# Logs en tiempo real
docker logs -f testigo-app

# Reiniciar con cambios
docker stop testigo-app && docker rm testigo-app
docker build -t testigo-app . && docker run -d --name testigo-app -p 8090:8090 --env-file .env testigo-app

# Crear superuser por CLI
docker exec testigo-app /app/pocketbase superuser upsert admin@email.com password123
```

## Diseño

Estética **brutalista**: negro puro, blanco, tipografía monoespaciada (JetBrains Mono), cero animaciones festivas, cero colores vibrantes. La interfaz es un espejo frío.

- Desktop: 3 columnas (Deberes / Cumplido / Fallido)
- Mobile: navegación por tabs

## Licencia

MIT
