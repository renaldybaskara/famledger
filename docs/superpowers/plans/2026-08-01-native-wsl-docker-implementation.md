# Native WSL Docker Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run Budgetin's six-service default stack, including PaddleOCR, on Docker Engine inside Ubuntu 24.04 WSL2 without Docker Desktop.

**Architecture:** Ubuntu 24.04 WSL2 owns the Docker daemon, BuildKit, images, networks, and named volumes. The Windows checkout is mounted at `/mnt/c/Project/FinTracker`; Caddy exposes a single `http://localhost` entry point while PostgreSQL, Valkey, API, web, and OCR stay on the internal Compose network.

**Tech Stack:** Windows 11 WSL2, Ubuntu 24.04, systemd, Docker Engine, Docker Compose v2, Go 1.22, Node 22, pnpm 9, Expo 52, PostgreSQL 16, Valkey 8, Caddy 2, Python 3.11, PaddleOCR.

## Global Constraints

- Docker Desktop must not be required or running when the final stack is verified.
- OCR is enabled by default and remains lazy-loaded until the first scan.
- Do not run `docker compose down -v`, delete named volumes, or reset the Git worktree.
- Preserve the existing `.env` file and never print secret values.
- Preserve unrelated tracked and untracked user changes.
- Exclude Grafana, Prometheus, Loki, MinIO, Uptime Kuma, GlitchTip, Plausible, and Ollama from the local stack.
- Use fresh command output before reporting any build, test, or health-check result.

---

## File Structure

- `docker-compose.yml` — six default services, health checks, networks, and named volumes.
- `docker-compose.dev.yml` — port and development-mode overrides for those same six services only.
- `infra/caddy/Caddyfile` — reverse proxies only the deployed web and API services.
- `apps/ocr-service/main.py` — existing OCR endpoints; behavior remains unchanged.
- `apps/ocr-service/Dockerfile` — OCR runtime and container health support.
- `apps/web/Dockerfile` — deterministic pnpm install, type-check, and Expo export.
- `apps/web/package.json` — pinned package manager and existing validation scripts.
- `apps/web/src/lib/theme.ts` — complete typed light/dark theme contract.
- `apps/web/app/(auth)/login.tsx` — corrected theme property reference.
- `apps/web/app/(tabs)/_layout.tsx` — typed tab icon callback inputs.
- `apps/web/app/(tabs)/accounts.tsx` — account type aligned with the API contract.
- `apps/web/app/(tabs)/savings-goals/create.tsx` — React Query account result usage.
- `apps/web/app/(tabs)/settings.tsx` — theme availability inside billing UI.
- `apps/web/components/transactions/*.tsx` — valid typed theme properties.
- `apps/web/src/lib/sentry.ts` — typed environment access.
- `apps/web/types/modules.d.ts` — ambient declarations only for packages that still lack usable declarations after a clean install.
- `README.md` — native WSL startup and verification commands.

---

### Task 1: Establish the Ubuntu 24.04 WSL2 Runtime

**Files:**
- No repository files modified.
- System configuration: Ubuntu `/etc/wsl.conf`.

**Interfaces:**
- Produces: a WSL distribution named `Ubuntu-24.04` that executes Linux commands.
- Consumes: Windows optional features for WSL2 and virtualization.

- [ ] **Step 1: Record the failing/precondition check**

Run from PowerShell:

```powershell
wsl.exe --status
wsl.exe --list --verbose
wsl.exe -d Ubuntu-24.04 -- bash -lc 'printf "distro=%s\n" "$(. /etc/os-release && echo "$ID:$VERSION_ID")"'
```

Expected before installation: either `Ubuntu-24.04` is absent, or the final command fails because the distribution does not exist. If it already prints `distro=ubuntu:24.04`, skip installation.

- [ ] **Step 2: Stop Docker Desktop without deleting its data**

```powershell
docker desktop stop
```

Verify:

```powershell
docker desktop status
```

Expected: `Status stopped`. If the command hangs, terminate Docker Desktop processes only after confirming no Docker Desktop engine command is active.

- [ ] **Step 3: Install Ubuntu 24.04 when absent**

```powershell
wsl.exe --install --distribution Ubuntu-24.04 --no-launch
wsl.exe --set-version Ubuntu-24.04 2
```

If Windows reports that a restart is required, stop execution and ask the user to restart Windows. Do not continue with partial WSL configuration.

- [ ] **Step 4: Enable systemd**

Run as the distribution root user:

```powershell
wsl.exe -d Ubuntu-24.04 -u root -- bash -lc 'printf "[boot]\nsystemd=true\n" > /etc/wsl.conf'
wsl.exe --shutdown
```

Then start Ubuntu and verify:

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'test "$(ps -p 1 -o comm=)" = systemd'
```

Expected: exit code `0`.

- [ ] **Step 5: Verify repository access**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'test -f /mnt/c/Project/FinTracker/docker-compose.yml && test -f /mnt/c/Project/FinTracker/apps/api-go/go.mod'
```

Expected: exit code `0`.

---

### Task 2: Install Native Docker Engine and Compose

**Files:**
- No repository files modified.
- System packages and `/etc/apt/keyrings/docker.asc` inside Ubuntu.

**Interfaces:**
- Consumes: working Ubuntu 24.04 systemd environment from Task 1.
- Produces: `docker.service`, BuildKit, and `docker compose` available inside Ubuntu.

- [ ] **Step 1: Verify Docker Engine is initially unavailable or identify an existing installation**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'command -v docker && docker version && docker compose version'
```

If all commands already pass and `docker info` identifies a Linux server that is not Docker Desktop, continue to Step 5.

- [ ] **Step 2: Install repository prerequisites**

```powershell
wsl.exe -d Ubuntu-24.04 -u root -- bash -lc 'apt-get update && apt-get install -y ca-certificates curl'
```

- [ ] **Step 3: Add Docker's official Ubuntu repository**

```powershell
wsl.exe -d Ubuntu-24.04 -u root -- bash -lc 'install -m 0755 -d /etc/apt/keyrings && curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc && chmod a+r /etc/apt/keyrings/docker.asc && printf "deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n" "$(dpkg --print-architecture)" "$(. /etc/os-release && echo "$VERSION_CODENAME")" > /etc/apt/sources.list.d/docker.list'
```

- [ ] **Step 4: Install and start Docker**

```powershell
wsl.exe -d Ubuntu-24.04 -u root -- bash -lc 'apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin && systemctl enable --now docker'
```

- [ ] **Step 5: Grant the default Ubuntu user daemon access**

Determine the non-root default user:

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'id -un'
```

Then run inside Ubuntu, substituting only the exact printed user:

```bash
sudo usermod -aG docker "$(id -un)"
```

Restart the distribution session:

```powershell
wsl.exe --terminate Ubuntu-24.04
```

- [ ] **Step 6: Verify native daemon and Compose**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'docker info --format "server={{.ServerVersion}} os={{.OperatingSystem}}" && docker compose version && systemctl is-active docker'
```

Expected: Linux server details, Compose v2, and `active`.

---

### Task 3: Repair and Test the Six-Service Compose Topology

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`
- Modify: `infra/caddy/Caddyfile`
- Modify: `apps/ocr-service/Dockerfile`

**Interfaces:**
- Consumes: native Docker Compose from Task 2.
- Produces: valid base and development Compose projects with six services.

- [ ] **Step 1: Run the existing configuration checks and capture the failure**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker compose config --quiet'
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet'
```

Expected baseline: base passes; development override fails with `service "uptime-kuma" has neither an image nor a build context specified`.

- [ ] **Step 2: Restrict the development override to existing services**

Keep overrides for only:

```yaml
services:
  caddy:
    ports:
      - "80:80"
      - "443:443"
      - "2019:2019"
  api:
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: development
  web:
    ports:
      - "3000:80"
  postgres:
    ports:
      - "5432:5432"
  redis:
    ports:
      - "6379:6379"
  ocr:
    ports:
      - "5000:5000"
```

Remove `minio`, `ollama`, `grafana`, `prometheus`, `uptime-kuma`, and `glitchtip`.

- [ ] **Step 3: Remove proxy sites for excluded services**

Keep the Caddy global options and the `:80` application site. Inside that site, retain only:

```caddyfile
handle /api/* {
    reverse_proxy api:4000 {
        header_up X-Forwarded-Proto {http.request.header.X-Forwarded-Proto}
    }
}

handle {
    reverse_proxy web:80
}
```

Keep compression, access logging, and security headers. Remove routes/sites for MinIO, Grafana, Uptime Kuma, GlitchTip, and Plausible.

- [ ] **Step 4: Add an OCR container health check**

Add to `apps/ocr-service/Dockerfile` before `CMD`:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=5)" || exit 1
```

Add to the `ocr` Compose service:

```yaml
healthcheck:
  test:
    - CMD
    - python
    - -c
    - "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=5)"
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 20s
```

- [ ] **Step 5: Re-run both Compose configuration tests**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker compose config --quiet && test "$(docker compose config --services | wc -l)" -eq 6'
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet'
```

Expected: both exit `0`; base service count is six.

- [ ] **Step 6: Commit only Compose/Caddy/OCR topology changes**

```powershell
git add -- docker-compose.yml docker-compose.dev.yml infra/caddy/Caddyfile apps/ocr-service/Dockerfile
git diff --cached --check
git commit -m "fix: make local Docker topology self-contained"
```

Before committing, verify `git diff --cached --name-only` contains exactly those files.

---

### Task 4: Make the Web Build Deterministic

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/Dockerfile`
- Test: Docker build stages in `apps/web/Dockerfile`

**Interfaces:**
- Consumes: `apps/web/pnpm-lock.yaml` lockfile version 9.
- Produces: reproducible Node 22/pnpm 9 dependency installation and mandatory type-check before export.

- [ ] **Step 1: Capture the clean Docker build failure**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker build --no-cache --target builder -t budgetin-web-check ./apps/web'
```

Expected: failure at dependency, type-check, or Expo export. Preserve the complete first error.

- [ ] **Step 2: Pin pnpm and require type checking**

Add to `apps/web/package.json`:

```json
"packageManager": "pnpm@9.15.9"
```

Change the Docker base setup to:

```dockerfile
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
```

Add before Expo export in the builder stage:

```dockerfile
RUN node_modules/.bin/tsc --noEmit
```

- [ ] **Step 3: Rebuild to expose only source-level errors**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker build --target builder -t budgetin-web-check ./apps/web'
```

Expected: dependency installation succeeds; the build stops at the first remaining TypeScript errors.

- [ ] **Step 4: Commit deterministic toolchain changes**

```powershell
git add -- apps/web/package.json apps/web/Dockerfile
git diff --cached --check
git commit -m "build: make web toolchain deterministic"
```

---

### Task 5: Correct Frontend Type Contract Errors

**Files:**
- Modify: `apps/web/src/lib/theme.ts`
- Modify: `apps/web/app/(auth)/login.tsx`
- Modify: `apps/web/app/(tabs)/_layout.tsx`
- Modify: `apps/web/app/(tabs)/accounts.tsx`
- Modify: `apps/web/app/(tabs)/savings-goals/create.tsx`
- Modify: `apps/web/app/(tabs)/settings.tsx`
- Modify: `apps/web/src/lib/sentry.ts`
- Modify as identified by fresh type-check: `apps/web/components/transactions/PaymentSlipScanModal.tsx`
- Modify as identified by fresh type-check: `apps/web/components/transactions/TransactionDetailModal.tsx`
- Modify as identified by fresh type-check: `apps/web/components/transactions/TransactionItem.tsx`
- Create only if clean package types remain unavailable: `apps/web/types/modules.d.ts`
- Test: `npm run type-check` inside the clean web builder

**Interfaces:**
- Consumes: `ThemeColors`, `Account`, and React Query hook contracts.
- Produces: zero-error TypeScript compilation without changing user-visible finance behavior.

- [ ] **Step 1: Save the fresh TypeScript error list**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker build --target builder -t budgetin-web-check ./apps/web'
```

Expected: fails at `tsc --noEmit`; use this clean-install list rather than errors from the existing Windows `node_modules`.

- [ ] **Step 2: Complete the theme contract**

Add the properties actually consumed by transaction and OCR components to `ThemeColors`:

```typescript
warning: string
warningSoft: string
transfer: string
incomeBg: string
expenseBg: string
transferBg: string
```

Provide concrete values in both `lightColors` and `darkColors`. Use existing palette colors: mustard for warnings, blue for transfers, and translucent income/expense/transfer backgrounds.

Replace the login typo:

```typescript
C.creamSunk
```

with:

```typescript
C.creamSunken
```

- [ ] **Step 3: Align component callback and account types**

Type each tab icon callback:

```typescript
tabBarIcon: ({ focused }: { focused: boolean }) => (
```

Replace the local account type union with the API-supported values:

```typescript
type AccountType = 'bank' | 'credit' | 'cash' | 'ewallet'
```

- [ ] **Step 4: Use the React Query account result correctly**

Replace destructuring of a nonexistent `accounts` property:

```typescript
const { data: accounts = [] } = useAccounts()
```

- [ ] **Step 5: Make the billing theme local**

At the start of the billing component that references `C`, add:

```typescript
const C = useTheme()
```

Do not introduce a module-global theme value.

- [ ] **Step 6: Type environment access in Sentry setup**

Use a narrow global type instead of indexing untyped `globalThis`:

```typescript
const runtimeEnv = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}).process?.env
```

Read optional Sentry variables through `runtimeEnv`.

- [ ] **Step 7: Add ambient declarations only when clean dependencies still lack them**

If a clean build still reports packages with JavaScript but no declarations, create:

```typescript
declare module 'react-native-purchases-ui'
```

Do not declare `react-hook-form`, Expo, or AsyncStorage modules if their clean installed packages already provide types; masking valid package types would weaken checking.

- [ ] **Step 8: Run type-check and export**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker build --target builder -t budgetin-web-check ./apps/web'
```

Expected: `tsc --noEmit` and `expo export --platform web` both finish; exit `0`.

- [ ] **Step 9: Commit only verified frontend fixes**

```powershell
git add -- apps/web/src/lib/theme.ts apps/web/app apps/web/components/transactions apps/web/src/lib/sentry.ts apps/web/types
git diff --cached --check
git commit -m "fix: restore clean frontend type checking"
```

Review the staged names and hunks first so unrelated user changes are not accidentally included.

---

### Task 6: Verify the Go API in Its Linux Build Environment

**Files:**
- Modify only if a test exposes a deployment-specific defect: exact failing Go source or test file.
- Test: `apps/api-go/internal/**/*_test.go`

**Interfaces:**
- Consumes: Go 1.22 module and current API source.
- Produces: passing Go tests and a static Linux API binary.

- [ ] **Step 1: Run all Go tests in an isolated Go container**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'docker run --rm -v /mnt/c/Project/FinTracker/apps/api-go:/src -w /src golang:1.22-alpine sh -lc "apk add --no-cache git build-base >/dev/null && go test ./..."'
```

Expected: all packages pass. If one fails, preserve the complete test name and error.

- [ ] **Step 2: For any failure, write or retain the smallest failing test**

Reproduce the failure without cached results:

```bash
go test ./... -count=1 -v
```

Expected before a fix: the same test fails with a reproducible non-zero exit.
Make one root-cause fix only, then rerun this uncached command before the
complete suite.

- [ ] **Step 3: Run the complete suite and production API build**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker compose build api'
wsl.exe -d Ubuntu-24.04 -- bash -lc 'docker run --rm -v /mnt/c/Project/FinTracker/apps/api-go:/src -w /src golang:1.22-alpine sh -lc "apk add --no-cache git build-base >/dev/null && go test ./..."'
```

Expected: both commands exit `0`.

- [ ] **Step 4: Commit a Go fix only if one was necessary**

Stage only the exact Go test and source files used for the red/green cycle:

```powershell
git diff --cached --check
git commit -m "fix: restore API Linux build"
```

Skip this commit if no Go changes were required.

---

### Task 7: Build and Start the Full Default WSL Stack

**Files:**
- No additional source files expected.

**Interfaces:**
- Consumes: valid Compose topology and passing web/API builds.
- Produces: six running local containers with persistent named volumes.

- [ ] **Step 1: Verify required variables without printing values**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && test -f .env && for key in JWT_SECRET JWT_REFRESH_SECRET POSTGRES_PASSWORD REDIS_PASSWORD; do grep -q "^${key}=." .env || exit 1; done'
```

Expected: exit `0`.

- [ ] **Step 2: Build every image**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker compose build'
```

Expected: API, web, and OCR images build successfully.

- [ ] **Step 3: Start without recreating or deleting volumes**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker compose up -d'
```

- [ ] **Step 4: Wait on actual container health**

Poll for up to five minutes:

```bash
cd /mnt/c/Project/FinTracker
deadline=$((SECONDS+300))
while [ "$SECONDS" -lt "$deadline" ]; do
  unhealthy="$(docker compose ps --format json | grep -E '"Health":"(unhealthy|starting)"' || true)"
  exited="$(docker compose ps --all --format json | grep -E '"State":"(exited|dead)"' || true)"
  [ -z "$unhealthy$exited" ] && exit 0
  sleep 5
done
docker compose ps
exit 1
```

Expected: exit `0`.

---

### Task 8: End-to-End Verification and Documentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: running six-service stack.
- Produces: verified local URLs and documented native-WSL workflow.

- [ ] **Step 1: Verify container state**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker compose ps'
```

Expected: `postgres`, `redis`, `api`, `web`, `caddy`, and `ocr` are running; services with health checks report healthy.

- [ ] **Step 2: Verify public web and API endpoints**

```powershell
Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost/' -TimeoutSec 15
Invoke-RestMethod -Uri 'http://localhost/api/health' -TimeoutSec 15
```

Expected: web HTTP 200 and API JSON with `status` equal to `ok`.

- [ ] **Step 3: Verify OCR from inside the Compose network**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker compose exec -T api wget -qO- http://ocr:5000/health'
```

Expected: OCR health JSON and exit `0`.

- [ ] **Step 4: Inspect startup logs**

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker compose logs --no-color --tail=200 api web ocr caddy'
```

Expected API markers:

```text
Database connected
Database migrated
Default categories ready
```

There must be no fatal, panic, or repeated restart messages.

- [ ] **Step 5: Document the exact native-WSL workflow**

Add a concise README section containing:

```powershell
wsl.exe -d Ubuntu-24.04
cd /mnt/c/Project/FinTracker
docker compose up -d --build
docker compose ps
```

Document `http://localhost`, `http://localhost/api/health`, OCR being enabled by default, and the fact that Docker Desktop is not required.

- [ ] **Step 6: Run the final verification gate**

Freshly rerun:

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker compose config --quiet && docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet'
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker compose build'
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Project/FinTracker && docker compose ps'
Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost/' -TimeoutSec 15
Invoke-RestMethod -Uri 'http://localhost/api/health' -TimeoutSec 15
```

Report exact service counts and test results. Do not claim success if any command is non-zero.

- [ ] **Step 7: Commit documentation only**

```powershell
git add -- README.md
git diff --cached --check
git commit -m "docs: add native WSL Docker workflow"
```
