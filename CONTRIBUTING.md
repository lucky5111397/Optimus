# Contributing to OPTIMUS

Thank you for your interest in contributing to **OPTIMUS** — an autonomous AI software engineering platform.

This guide outlines our development workflow, branch naming standards, commit message conventions, testing procedures, and security requirements.

---

## 1. Development Principles & Workflow

OPTIMUS is maintained with production-grade engineering discipline. Every change follows a structured, traceable lifecycle:

$$\text{Issue} \longrightarrow \text{Branch} \longrightarrow \text{Implementation} \longrightarrow \text{Testing} \longrightarrow \text{Pull Request} \longrightarrow \text{CI Automation} \longrightarrow \text{Review} \longrightarrow \text{Merge} \longrightarrow \text{Branch Cleanup}$$

### Solo-Developer Governance Model
OPTIMUS is currently developed under a solo-developer model with automated governance:
- **No Direct Push to `main`**: The `main` branch is protected by a GitHub Ruleset requiring PR-based delivery, linear history, and passing CI status checks.
- **Self-Review with Quality Gates**: While artificial multi-reviewer approval or `CODEOWNERS` sign-offs are not required to unblock merges, all changes must be delivered via Pull Requests that satisfy all automated CI checks and pass rigorous self-review before merging.
- **Linear History**: Commits to `main` are integrated via squash-merge or rebase-merge to maintain a clean, bisectable history. Force-pushes to `main` are strictly blocked.
- **Automated CI Status Checks**: Required status checks currently comprise Backend Validation & Benchmark and Frontend Build & Verification (`.github/workflows/ci.yml`). CodeQL SAST and Dependency Review workflows are pre-configured in `.github/workflows/` and will be activated once GitHub Code Security / Advanced Security is enabled for this private repository.

---

## 2. Issue Tracking Etiquette

1. **Issue First**: Every unit of work (feature, bug fix, phase implementation, or chore) must be tracked by an open GitHub Issue before development starts.
2. **Issues Stay Open During Development**: Issues must remain open while work is in progress.
3. **Automated Issue Closure**: PRs should link to their corresponding issue using GitHub keywords in the PR description:
   - `Closes #123`
   - `Fixes #123`
   - `Resolves #123`
4. **Issue Templates**: When filing issues, use the provided GitHub Issue Forms:
   - **Bug Report**: For unexpected behavior or errors.
   - **Feature Request**: For new capabilities or architectural enhancements.
   - **Engineering Task / Phase Task**: For milestones, refactorings, and maintenance tasks.

---

## 3. Branch Naming Conventions

Always branch from the latest `main`. Use descriptive, hyphen-separated branch names prefixed with the change category:

| Branch Prefix | Purpose | Example |
|---|---|---|
| `feat/` | New features or platform capabilities | `feat/symbol-graph-explorer` |
| `fix/` | Bug fixes and runtime corrections | `fix/learn-more-scroll-anchor` |
| `chore/` | Maintenance, dependencies, or repo governance | `chore/issue-6-repository-governance` |
| `phase-<N>/` | Major phased milestone implementations | `phase-17/benchmark-harness` |
| `refactor/` | Code refactoring without behavioral changes | `refactor/task-context-assembler` |
| `test/` | Adding or updating tests and benchmark suites | `test/add-ast-parser-fixtures` |
| `docs/` | Documentation improvements | `docs/architecture-guide` |

---

## 4. Commit Message Standards

OPTIMUS follows the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Types
- `feat`: A new feature or capability
- `fix`: A bug fix
- `chore`: Maintenance, dependencies, build, or governance updates
- `refactor`: Code changes that neither fix a bug nor add a feature
- `test`: Adding or correcting tests and benchmarks
- `docs`: Documentation changes only
- `security`: Security patches, vulnerability mitigations, or hardening
- `perf`: Code changes that improve performance

### Scopes
Common scopes include: `backend`, `frontend`, `worker`, `ai`, `ast`, `benchmark`, `ci`, `auth`, `settings`, `security`.

### Examples
- `feat(benchmark): add automated scorecard generation and mock mode`
- `fix(frontend): resolve smooth scroll behavior on landing page`
- `chore(governance): add pull request template and issue forms`
- `security(sandbox): enforce path containment on relative tool executions`

---

## 5. Local Verification & Testing Requirements

Before opening a Pull Request, all local quality gates must pass:

### Backend Checks
```bash
cd backend

# 1. Syntax check
node --check src/server.js

# 2. Run unit and security tests
npm test

# 3. Run deterministic mock benchmark
npm run benchmark -- --mode=mock
```

### Frontend Checks
```bash
cd frontend

# Verify production build compilation
npm run build
```

### Git Diff Check
Ensure there are no unintended whitespace errors or merge conflicts:
```bash
git diff --check
```

---

## 6. Security Guidelines for Contributors

Security and execution safety are fundamental to OPTIMUS:

1. **No Committed Secrets**: Never commit `.env` files, API keys, JWT secrets, service account credentials, or private tokens. All `.env` files (except `.env.example`) are gitignored.
2. **Sandbox Containment**: Code executing inside the agentic engine must never break out of workspace boundaries. All path resolutions must pass through containment validation (`safeResolve`).
3. **Token & Credential Scrubbing**: Any command stdout, stderr, or AI chat interaction must sanitize and redact sensitive values (tokens, secrets, passwords) before persisting logs or returning API responses.
4. **Input Sanitization**: All endpoint inputs, task titles, and user environment variables must be validated and sanitized against strict length, regex, and type boundaries.
5. **No Production OpenRouter Exhaustion**: Local development and automated testing must default to mock engines or offline fixtures. Live AI requests require explicit user authorization.

---

## 7. Pull Request Checklist

Before submitting a Pull Request:
- [ ] Code is branched from and rebased against the latest `main`.
- [ ] PR description uses `.github/pull_request_template.md` and links the corresponding issue (`Closes #X`).
- [ ] Local tests (`npm test`), mock benchmarks, and frontend builds (`npm run build`) pass cleanly.
- [ ] No secrets or unredacted keys are introduced.
- [ ] Clean diff with zero whitespace warnings (`git diff --check`).
- [ ] All automated CI status checks pass on GitHub.
