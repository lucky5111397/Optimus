# Security Policy

The OPTIMUS project takes software security, execution containment, and vulnerability management seriously. As an autonomous AI software engineering platform capable of executing tools and modifying code, security is an architectural requirement.

---

## 1. Supported Versions

Security updates are actively applied to the default branch (`main`) and official releases:

| Version / Branch | Supported |
|---|---|
| `main` | :white_check_mark: Yes (actively maintained) |
| `< 1.0.0` releases | :white_check_mark: Yes |
| Historical development branches | :x: No |

---

## 2. Reporting a Vulnerability

**DO NOT report security vulnerabilities via public GitHub issues.**

If you believe you have discovered a security vulnerability or execution sandbox escape in OPTIMUS, please report it privately:

1. **GitHub Security Advisory (Preferred)**:
   Navigate to the repository's [Security Advisories](https://github.com/lucky5111397/Optimus/security/advisories/new) page and click **"Report a vulnerability"**.
2. **Private Disclosure**:
   Provide a detailed report including:
   - Type of issue (e.g., sandbox escape, path traversal, credential exposure, injection, auth bypass).
   - Component or subsystem affected (e.g., `executionService`, `astService`, auth middleware, REST endpoints).
   - Step-by-step reproduction instructions or proof-of-concept (PoC).
   - Potential impact of the vulnerability.

### Response Timeline
- **Initial Acknowledgment**: Within 48–72 hours of report submission.
- **Triage & Assessment**: Maintainer will investigate and reproduce the issue privately.
- **Fix & Disclosure**: A security patch will be developed and verified on a private security advisory branch before release and coordinated disclosure.

---

## 3. OPTIMUS Security Architecture & Containment Boundaries

OPTIMUS incorporates defense-in-depth architectural controls:

### 1. Workspace Sandboxing & Path Containment
- **`safeResolve` Guard**: All file manipulations (reads, writes, edits, directory listings) are strictly constrained to the assigned task workspace. Path traversal sequences (`../`, absolute path escapes, symlink deviations) are detected and blocked before filesystem access.
- **Command Whitelisting & Guardrails**: The execution engine rejects destructive host commands (e.g., recursive root deletions, raw partition formatting, kernel alterations) and bounds all subprocess lifetimes with hard execution timeouts.

### 2. Credential Scrubbing & Token Redaction
- **Log Sanitization**: Terminal output, execution streams, AI prompt payloads, and benchmark scorecards automatically scrub sensitive authentication headers, OpenRouter keys, JWT secrets, and user environment variables before persistence.
- **Repository Cleanliness**: The repository strictly gitignores all `.env` files (except `.env.example`). GitHub Secret Scanning and Push Protection are enabled to block unintended credential commits at the remote boundary.

### 3. Plan Hash Verification & Human-in-the-Loop Approval
- **Tamper Detection**: Tasks operating under supervised mode require human plan approval. Generated implementation plans are hashed so the execution engine verifies that executed steps match the approved plan without in-flight drift or tampering.

### 4. API & Network Hardening
- **Sliding-Window Rate Limiting**: In-memory rate limiters protect authentication endpoints (60 req / 15 min) and task execution endpoints (120 req / 1 min) from denial-of-service and brute-force attacks.
- **Strict HTTP Headers**: All HTTP responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 0`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- **CORS Origin Containment**: Cross-Origin requests are restricted to explicitly configured origin domains (`FRONTEND_URL` and authorized local dev hosts).

### 5. Automated Static & Supply-Chain Analysis
- **Dependabot Updates**: Active and automated. Dependabot continuously monitors and generates pull requests for outdated and vulnerable dependencies across `backend`, `frontend`, `worker`, and GitHub Actions (leveraging the repository's active Dependency Graph).
- **CodeQL SAST & Dependency Review Workflows**: Workflow definitions (`.github/workflows/codeql.yml` and `.github/workflows/dependency-review.yml`) are pre-configured in the repository. Because this repository is private, automated execution of CodeQL code scanning and PR dependency review requires GitHub Code Security / GitHub Advanced Security (GHAS) entitlement. Until that entitlement is enabled, these workflows are preserved in a future-ready manual dispatch state with automated triggers commented out to prevent unavoidable CI failures.
