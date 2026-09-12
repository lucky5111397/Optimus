# OPTIMUS — Developer & Contributor Guide

This guide details local environment setup, architecture workflows, security policies, and API specifications for developing on OPTIMUS.

---

## 1. Prerequisites & Tooling

Ensure the following tools are installed on your host machine:

- **Node.js**: `v20.x` or higher (`node -v`)
- **npm**: `v10.x` or higher (`npm -v`)
- **Git**: `2.40+`
- **MongoDB**: Community Server `6.0+` locally or an accessible MongoDB Atlas instance
- **Docker & Docker Compose**: (Optional, for containerized local workflows)

---

## 2. Environment Variables Configuration

All configuration templates are located in their respective project directories.

### Backend (`backend/.env`)

```ini
# Application Port
PORT=3000

# Client Application URL (used for CORS and OAuth redirects)
FRONTEND_URL=http://localhost:5173

# MongoDB Connection String
MONGODB_URI=mongodb://localhost:27017/optimus

# JWT Secret for Session Cookies (generate a 64+ char random string)
JWT_SECRET=your_dev_jwt_secret_do_not_use_in_prod

# Cookie Domain (leave empty for localhost development)
COOKIE_DOMAIN=

# Node Environment
NODE_ENV=development

# OpenRouter AI Gateway API Key
OPENROUTER_API_KEY=your_openrouter_api_key_here

# GitHub OAuth Integration (optional for local mock testing)
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback

# Firebase Service Account (optional for local mock testing)
FIREBASE_PROJECT_ID=optimus-dev
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@optimus-dev.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

### Frontend (`frontend/.env`)

```ini
# Backend API Base Endpoint
VITE_API_URL=http://localhost:3000/api
```

### Worker (`worker/.env`)

```ini
# Worker Port
PORT=8080
NODE_ENV=development
```

---

## 3. Running Services Locally

### Running Backend
```bash
cd backend
npm install
npm run dev
```
The server starts with `nodemon` watching `src/` on `http://localhost:3000`.

### Running Frontend
```bash
cd frontend
npm install
npm run dev
```
Vite will start the development server on `http://localhost:5173`.

### Running Worker
```bash
cd worker
npm install
npm start
```
Starts the isolated worker execution sandbox on `http://localhost:8080` to handle untrusted repository execution requests.

### Production Build Verification
To ensure code compiles cleanly for production:
```bash
cd frontend
npm run build
```

---

## 4. API Endpoints Reference

### Health & Diagnostic
- `GET /api/health` — Basic uptime status
- `GET /api/health/live` — Returns service uptime and ISO timestamp
- `GET /api/health/ready` — Returns database and AI gateway connectivity status

### Authentication & Account
- `POST /api/auth/google` — Authenticate using Firebase Google ID token
- `POST /api/auth/logout` — Clears JWT session cookie
- `GET /api/auth/me` — Returns current authenticated user profile
- `PUT /api/auth/profile` — Update user display name and username
- `GET /api/auth/github/connect` — Initiates GitHub OAuth linking flow
- `POST /api/auth/github/disconnect` — Unlinks connected GitHub account

### User Settings (`/api/settings`)
*Protected by `requireAuth` middleware.*

- `GET /api/settings`
  - Returns: `{ envVars: [{ key, value }], aiPreferences: { defaultModel, maxTurns, autonomyLevel } }`
- `PUT /api/settings/environment`
  - Body: `{ envVars: [{ key: "ENV_KEY", value: "ENV_VAL" }] }`
  - Validation: Key must match `/^[A-Za-z_][A-Za-z0-9_]*$/`, key max length 100, value max length 5000.
- `PUT /api/settings/ai`
  - Body: `{ defaultModel?: string, maxTurns?: number, autonomyLevel?: "supervised"|"autonomous" }`
  - Validation: `maxTurns` between 1 and 100, `autonomyLevel` in whitelist.
- `PUT /api/settings`
  - Combined endpoint accepting `{ envVars, aiPreferences }`.

### Repositories (`/api/repositories`)
- `GET /api/repositories` — List user repositories
- `POST /api/repositories/import` — Import and trigger AST indexing for a GitHub repository
- `GET /api/repositories/:id` — Get detailed repository metadata and branch status

### Tasks & Execution (`/api/tasks`)
- `GET /api/tasks` — List tasks scoped to user
- `POST /api/tasks` — Create task for repository
- `POST /api/tasks/:id/plan` — Generate multi-turn implementation plan
- `POST /api/tasks/:id/approve` — Approve plan and start execution
- `GET /api/tasks/:id/execution` — Stream / poll execution logs and diff

---

## 5. Security & Hygiene Policies

1. **No Committed Secrets**: Never commit `.env` files, production credentials, service account JSON files, or private keys. The root `.gitignore` enforces exclusion of `.env*` except `.env.example`.
2. **Rate Limiting**:
   - Authentication routes (`/api/auth/*`) are protected by a sliding-window limiter (60 requests per 15 minutes).
   - Task execution routes (`/api/tasks/*`) are capped at 120 requests per minute to prevent resource exhaustion.
3. **CORS Security**: Cross-Origin requests are restricted to `FRONTEND_URL`, `http://localhost:5173`, and `http://127.0.0.1:5173`. Credentials (`cookies`) are strictly supported only for permitted origins.
4. **HTTP Headers**: All responses carry `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 0`, and `Referrer-Policy: strict-origin-when-cross-origin`.
5. **Error Masking**: In `production` (`NODE_ENV=production`), internal exception stacks and error messages are masked from API responses to prevent information disclosure.
6. **Input Sanitization**: User-supplied environment keys and task inputs undergo strict regex and boundary checks on the backend before being written to MongoDB.

---

## 6. Design System & Frontend Tokens

OPTIMUS uses the **Deep Space Dark** Stitch design system:

| Token | Hex / Value | Usage |
|---|---|---|
| `bg-background` | `#0A0C10` | Main application background |
| `bg-surface` | `#0D1117` | Card, container, and sidebar background |
| `bg-modal` | `#161B22` | Modal overlays, elevated surfaces |
| `border-border` | `#30363D` | Structural dividers and borders |
| `text-primary` | `#3B82F6` | Interactive buttons, active links, accents |
| `text-text-primary` | `#DFE2EB` | High-emphasis body text and headings |
| `text-text-secondary` | `#C2C6D6` | Subtitles, labels, and muted copy |
| `font-mono` | JetBrains Mono | Code blocks, environment keys, diffs |

---

## 7. Contributing & Vulnerability Reporting

- **Development Workflow & PR Process**: See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for branch naming standards, Conventional Commit rules, automated testing requirements, and the Pull Request checklist.
- **Security Policy & Responsible Disclosure**: See [`SECURITY.md`](../SECURITY.md) for vulnerability disclosure channels, sandbox containment boundaries, and token sanitization standards.
