## Associated Issue
<!-- Link the issue that this PR resolves. Use keywords like Closes #X, Fixes #X, or Resolves #X -->
Closes #

## Summary of Changes
<!-- Provide a concise description of the purpose of this PR and what changes were made. -->

## Type of Change
<!-- Select all that apply by marking with an 'x' -->
- [ ] `feat`: New feature or capability
- [ ] `fix`: Bug fix
- [ ] `chore`: Maintenance, dependencies, or repository governance
- [ ] `refactor`: Code change that neither fixes a bug nor adds a feature
- [ ] `docs`: Documentation updates
- [ ] `security`: Security enhancement or vulnerability remediation
- [ ] `test`: Adding or updating test suites / benchmarks

## Subsystem / Scope Affected
- [ ] Backend API (`backend/`)
- [ ] Frontend UI (`frontend/`)
- [ ] AI Gateway / Execution Engine (`backend/src/ai/`, `backend/src/services/`)
- [ ] Background Worker (`worker/`)
- [ ] Infrastructure & Docker (`infrastructure/`, `Dockerfile.*`, `compose`)
- [ ] CI/CD & GitHub Governance (`.github/`, workflows, templates)
- [ ] Documentation (`docs/`, `README.md`)

## Technical Implementation Details
<!-- Highlight key design choices, architectural changes, or non-obvious implementation details. -->

## Verification & Testing
<!-- Detail how the changes were verified. List test commands and results. -->
- [ ] Backend unit/security tests pass: `cd backend && npm test`
- [ ] Deterministic mock benchmark passes: `cd backend && npm run benchmark -- --mode=mock`
- [ ] Frontend production build passes: `cd frontend && npm run build`
- [ ] Syntax checks pass: `node --check <files>`
- [ ] Manual / browser verification (if frontend or UI changes included)

### Test Command Output / Evidence
```text
<!-- Paste relevant test/build output here -->
```

## Security & Safety Checklist
- [ ] No credentials, API keys, or private tokens committed (`.env` files excluded)
- [ ] Execution sandbox integrity and path containment (`safeResolve`) preserved
- [ ] Token scrubbing and credential redaction maintained in logs
- [ ] Input validation applied to all user-supplied data
- [ ] No arbitrary command execution outside bounded sandbox

## Breaking Changes & Migration Notes
<!-- Does this change introduce breaking API changes, database schema modifications, or environment variable changes? If yes, describe them here. -->
- [ ] None
- [ ] Yes (describe below):

## Pre-Merge Checklist
- [ ] Branch is rebased and up to date with `main`
- [ ] Commit messages follow conventional commits (`type(scope): description`)
- [ ] Clean git diff with no unintended files, whitespace errors, or debug artifacts
- [ ] All automated CI checks are passing
- [ ] Issue remains open until PR merge

