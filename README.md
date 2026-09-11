# OPTIMUS — Autonomous AI Software Engineer Platform

OPTIMUS is an autonomous engineering platform that inspects codebases, generates implementation plans, iteratively executes code modifications through specialized toolkits, validates diffs, and delivers pull requests.

---

## Architecture Overview

```
+--------------------------------------------------------------------+
|                       Frontend (React 18 + Vite)                   |
|       Stitch "Deep Space Dark" Design System & Lucide Icons        |
+---------------------------------+----------------------------------+
                                  | HTTP / REST (CORS + Cookies)
                                  v
+--------------------------------------------------------------------+
|                        Backend API (Express 5)                     |
|  - Rate Limiting (In-Memory Sliding Window)                        |
|  - Security Headers (X-Content-Type, X-Frame-Options, etc.)        |
|  - Auth Middleware (JWT Cookies, Google Firebase, GitHub OAuth)    |
|  - REST Endpoints (/auth, /repositories, /tasks, /settings, /api)  |
+-------------------+-----------------------------+------------------+
                    |                             |
                    v                             v
+-----------------------------+       +------------------------------+
|     MongoDB Database        |       |      AI Gateway              |
|  - Users & Accounts         |       |  - OpenRouter Multi-Model    |
|  - Repositories & Branches  |       |    Fallback Hierarchy        |
|  - Tasks, Context & Plans   |       |  - Autonomous Tool Calling   |
|  - Executions & Diffs       |       |  - Offline Mock Engine       |
|  - User Settings & Env Vars |       +------------------------------+
+-----------------------------+
```

---

## Core Capabilities

- **Codebase Indexing & AST Analysis**: Automatically crawls imported repositories, parses abstract syntax trees (via Babel and Acorn), and builds symbol definitions and file hierarchies.
- **AI Planning & Approval Workflow**: Synthesizes multi-step implementation plans detailing affected files, structural assumptions, and diff previews prior to execution approval.
- **Autonomous Multi-Turn Execution**: Executes safe file modifications, inspections, and command validations within bounded turn limits and configurable autonomy levels.
- **Pull Request Delivery**: Formats branch diffs and delivers pull requests directly to linked GitHub repositories.
- **Configurable Preferences & Environment**: Stores per-user environment variables and AI engine preferences (default model, turn constraints, autonomy level) backed by MongoDB.
- **Hardened Security**: Includes sliding-window rate limiters, strict HTTP security headers, CORS origin verification, and isolated credential management.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide React, React Router 6 |
| **Backend** | Node.js 20, Express 5, Mongoose 9, JWT, Cookie-Parser |
| **Database** | MongoDB 6+ |
| **AI Gateway** | OpenRouter REST API (Free-tier model hierarchy with fallback) |
| **Worker** | Node.js 20 microservice with health and info probes |
| **Containers** | Multi-stage Dockerfiles (`api`, `frontend`, `worker`), Docker Compose |

---

## Project Layout

```
Optimus/
|-- backend/               # Express 5 API Server
|   |-- src/
|   |   |-- ai/            # OpenRouter Gateway & Execution Engine
|   |   |-- config/        # Database & Firebase configuration
|   |   |-- controllers/   # Route handlers (auth, repos, tasks, settings, etc.)
|   |   |-- middleware/    # Auth verification & rate limiting
|   |   |-- models/        # Mongoose schemas (User, Task, Settings, etc.)
|   |   |-- routes/        # Express routers
|   |   `-- services/      # Code execution, indexing, recovery services
|   `-- .env.example       # Backend environment template
|-- frontend/              # Vite + React 18 Single-Page Application
|   |-- src/
|   |   |-- components/    # AppShell, Navigation, Shared UI
|   |   |-- features/      # Auth context, Repositories, Tasks
|   |   |-- pages/         # Dashboard, Analytics, History, Settings
|   |   `-- App.jsx        # Routing configuration
|   `-- .env.example       # Frontend environment template
|-- worker/                # Background worker service
|   |-- src/worker.js      # Worker health & info server
|   `-- Dockerfile         # Production worker container
|-- infrastructure/        # Docker Compose & container definitions
|   |-- Dockerfile.api     # Multi-stage API image
|   |-- Dockerfile.frontend# Nginx SPA image
|   `-- docker-compose.yml # Container orchestration
|-- .github/               # CI workflows, PR & issue templates, Dependabot
|-- docs/
|   `-- DEVELOPMENT.md     # Local setup, testing, and security guides
|-- CONTRIBUTING.md        # Branching, commits, PR guidelines, testing workflow
`-- SECURITY.md            # Responsible disclosure & execution security policy
```

---

## Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v20.x or later
- **npm**: v10.x or later
- **MongoDB**: Local instance running on `localhost:27017` or MongoDB Atlas URI

### 2. Environment Configuration
Copy `.env.example` templates and configure values:

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

### 3. Start Backend
```bash
cd backend
npm install
npm run dev
# Server listens on http://localhost:3000
```

### 4. Start Frontend
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

---

## Running with Docker Compose

Run the complete platform stack (API, Frontend, Worker, MongoDB) via Docker Compose:

```bash
cd infrastructure
docker compose up -d --build
```

Access points:
- **Frontend SPA**: `http://localhost:5173`
- **Backend API**: `http://localhost:3000`
- **Worker Probes**: `http://localhost:8080/health`
- **MongoDB**: `localhost:27017`

To inspect service health:
```bash
docker compose ps
docker compose logs -f api
```

---

## Health Probes

The backend exposes diagnostic endpoints for container orchestrators:
- `GET /api/health` — Basic service status
- `GET /api/health/live` — Liveness probe (uptime and timestamp)
- `GET /api/health/ready` — Readiness probe (database connection and AI gateway status)

---

## Contributing & Security

- **Contributing**: See [`CONTRIBUTING.md`](CONTRIBUTING.md) for branch naming conventions, Conventional Commits, testing instructions, and pull request guidelines.
- **Security Policy**: See [`SECURITY.md`](SECURITY.md) for vulnerability disclosure policies, sandbox boundaries, and credential hygiene practices.

---

## License

Internal proprietary software. All rights reserved.
