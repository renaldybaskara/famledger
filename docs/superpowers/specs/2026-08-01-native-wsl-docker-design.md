# Native WSL Docker Deployment Design

## Goal

Run Budgetin locally on Windows using Docker Engine inside Ubuntu 24.04
WSL2, without Docker Desktop, while keeping OCR enabled by default and
excluding obsolete ancillary services.

## Success Criteria

- Ubuntu 24.04 runs as a WSL2 distribution with systemd enabled.
- Docker Engine and the Docker Compose plugin run inside Ubuntu.
- Docker Desktop is not required to build, start, or operate Budgetin.
- The default Compose project contains PostgreSQL, Valkey, the Go API,
  Expo web/nginx, Caddy, and PaddleOCR.
- Both the base and local-development Compose configurations validate.
- Frontend type checking and static export complete successfully.
- Go tests and the Go production build complete successfully.
- All six containers become healthy or remain running as appropriate.
- `http://localhost` serves the web application.
- `http://localhost/api/health` returns a successful API health response.
- The OCR health endpoint responds from inside the Compose network.
- Existing source changes and persistent database volumes are preserved.

## Architecture

Windows hosts the repository at `C:\Project\FinTracker`. Ubuntu accesses the
same checkout at `/mnt/c/Project/FinTracker`. Docker Engine, BuildKit, and the
Compose plugin run as Linux services under systemd inside Ubuntu. Named Docker
volumes keep PostgreSQL, Valkey, Caddy, and PaddleOCR data in the WSL Linux
filesystem rather than on the Windows mount.

Caddy publishes ports 80 and 443 to the Windows host through WSL2 localhost
forwarding. It routes `/api/*` to the Go API and all application routes to the
nginx container serving the Expo static export.

## Default Services

| Service | Responsibility | Default |
|---|---|---|
| `postgres` | PostgreSQL application data | On |
| `redis` | Valkey token exchange and durable cache | On |
| `api` | Go/Gin API and Gmail background worker | On |
| `web` | Expo web static export served by nginx | On |
| `caddy` | Local reverse proxy and single public entry point | On |
| `ocr` | PaddleOCR payment-slip extraction | On |

Grafana, Prometheus, Loki, MinIO, Uptime Kuma, GlitchTip, Plausible, Ollama,
and other legacy services are outside this local deployment. References that
make the development Compose configuration invalid will be removed.

## OCR Resource Strategy

The OCR container starts by default. PaddleOCR model initialization remains
lazy, so the largest memory allocation occurs on the first scan instead of at
container startup. The Paddle model cache uses a named Linux volume to avoid
re-downloading models after restarts.

The expected stack footprint is approximately 1–1.5 GB RAM while idle and may
rise to 2–4 GB during OCR inference. This is the unavoidable cost of keeping
OCR available by default. The rest of the stack remains intentionally small.

## Installation Flow

1. Stop Docker Desktop so its `desktop-linux` context cannot conflict with the
   native WSL daemon.
2. Detect an existing Ubuntu 24.04 WSL2 distribution; install it if absent.
3. Enable systemd in Ubuntu through `/etc/wsl.conf`.
4. Restart WSL once to apply systemd configuration.
5. Install Docker Engine, BuildKit, and the Docker Compose plugin from Docker's
   official Ubuntu repository.
6. Add the Ubuntu user to the `docker` group and verify daemon access.
7. Run all project Docker commands inside Ubuntu from
   `/mnt/c/Project/FinTracker`.

No Docker Desktop data will be deleted. Docker Desktop and native WSL Docker
have separate image and volume stores.

## Project Repairs

### Compose

- Keep the six core services in the base Compose configuration.
- Make the development override contain overrides only for services that exist
  in the base configuration.
- Remove stale proxy routes to services excluded from the local deployment.
- Add an OCR health check so readiness is verifiable.
- Keep named volumes for all persistent data.

### Frontend

- Use the repository's locked dependency versions under Node 22 in the Docker
  build.
- Fix missing or inconsistent theme properties, invalid account types, hook
  return-shape usage, undefined theme variables, and required ambient module
  declarations.
- Require `npm run type-check` and Expo web export to pass from a clean install.

### Backend

- Run `go test ./...` in the Go build environment.
- Build the same static binary used by the production Docker image.
- Avoid behavior changes unrelated to local deployment.

## Data and Security

- Never run `docker compose down -v` during recovery.
- Never delete or reset the existing Windows checkout.
- Preserve the existing `.env` file and do not print secret values.
- Validate only whether required variables are present.
- PostgreSQL and Valkey continue using named volumes.

## Error Handling

- If WSL installation requires a Windows restart, stop and report that exact
  prerequisite.
- If systemd or virtualization is unavailable, capture the command output
  before changing configuration.
- If a build fails, isolate the failing service and fix only its root cause.
- If OCR cannot run within available memory, report measured usage and retain
  the working core stack rather than deleting data.

## Verification

The final verification sequence is:

1. `docker compose config --quiet`
2. Development override Compose validation
3. Frontend clean install, type-check, and Expo export
4. `go test ./...`
5. `docker compose build`
6. `docker compose up -d`
7. `docker compose ps`
8. HTTP check for `/`
9. HTTP check for `/api/health`
10. OCR health check inside the Compose network
11. Container log inspection for startup or migration failures

Completion requires fresh passing output from these checks. Any remaining
failure will be reported explicitly instead of being treated as successful.
