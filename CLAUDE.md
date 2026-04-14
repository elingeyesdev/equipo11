# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EnviroSense** — A real-time environmental data monitoring and simulation system for Bolivia. It simulates environmental metrics (temperature, air quality, water quality, noise, humidity) across 9 Bolivian departments, visualized on an interactive map.

## Tech Stack

- **Backend:** Node.js 20 + Express 5 + Socket.IO + PostgreSQL 16
- **Frontend:** React 19 + Vite + React Router + Mapbox GL
- **Infrastructure:** Docker & Docker Compose

## Commands

### Docker (recommended)
```bash
docker-compose up          # Start all services (PostgreSQL :5432, Backend :3000, Frontend :5173)
docker-compose up backend  # Backend only
docker-compose up frontend # Frontend only
```

### Backend (`/Backend`)
```bash
npm run dev    # Development with nodemon (hot-reload)
npm start      # Production
```

### Frontend (`/Frontend`)
```bash
npm run dev    # Vite dev server at :5173
npm run build  # Production build
npm run lint   # ESLint
npm run preview
```

## Architecture

### Data Flow
```
Frontend (React SPA :5173)
    ↓ HTTP REST + Socket.IO WebSocket
Backend (Express :3000)
    ├── /api/auth  →  PostgreSQL (usuarios table)
    └── Socket.IO  →  in-memory simulation engine
```

### Backend Structure
Follows a Controller → Service pattern within `/Backend/Src/modules/`:
- **`auth/`** — JWT-less auth (MVP stage); stores users in PostgreSQL
- **`simulacion/`** — Core simulation engine:
  - `simulacion.service.js` — Generates synthetic per-department data with realistic variance
  - `simulacion.socket.js` — Handles Socket.IO events
  - `departamentos.data.js` — Static config for Bolivia's 9 departments (coordinates, base values, variance)

Simulation data is **in-memory only** — nothing is persisted to the database.

### Frontend State Management
`SimulacionContext.jsx` is the single source of truth for all real-time data. It owns the Socket.IO connection and exposes state via the `useSimulacion()` hook. All pages and components consume simulation data through this hook.

### Socket.IO Event Protocol
| Event | Direction | Purpose |
|-------|-----------|---------|
| `simulacion:iniciar` | Client → Server | Start simulation with interval (ms) |
| `simulacion:detener` | Client → Server | Stop simulation |
| `simulacion:inyectar` | Client → Server | Inject manual data for a city |
| `simulacion:estado` | Server → Client | Broadcast current running state |
| `simulacion:datos` | Server → Client | Broadcast full data snapshot |

### Key Pages
- **`MapaMonitoreo/`** — Mapbox GL map with 9 city markers and a toggleable heatmap (5 metrics). Falls back to static data when simulation is inactive.
- **`PanelSimulacion/`** — Start/stop controls, interval selector, metric averages, per-department table, manual data injection form.

## Environment Variables

**Backend** (`/Backend/.env`):
```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sistema_ambiental
DB_USER=postgres
DB_PASSWORD=postgres
```

**Frontend** (`/Frontend/.env`):
```
VITE_MAPBOX_TOKEN=<mapbox_public_token>
```

A root `.env.example` documents these. Docker Compose automatically overrides local `.env` values for containerized runs.

## Important Context

- **Auth is not enforced** — `ProtectedRoute` is commented out (MVP stage); auth routes exist but pages are publicly accessible.
- **No test suite** — `npm test` is not implemented.
- **Code and comments are in Spanish** — the project language is Spanish; keep new comments and variable names consistent.
- **Database schema** — Single table `usuarios` initialized from `database/init.sql` on first container start.
- Adding a new department or metric means updating `departamentos.data.js` (backend config) and the corresponding Mapbox marker/heatmap logic in `MapaMonitoreo.jsx`.
