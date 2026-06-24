# SOP — Saku Android Release & OTA Update

## Overview

There are two ways to ship changes to the Android app:

| Method | Use when | Time |
|--------|----------|------|
| **OTA Update** (`eas update`) | JS/UI changes only — no new native modules | ~2 min |
| **Full Build** (`eas build`) | New native packages, permissions, or first install | ~15 min |

---

## Prerequisites

- `ngrok` installed and authenticated (`ngrok config add-authtoken <token>`)
- EAS CLI logged in (`npx eas whoami` — must show your account)
- Docker stack running (`docker compose ps` — all services Up)

---

## Step 1 — Start ngrok

```powershell
ngrok http 80
```

Verify the tunnel URL matches `eas.json`:

```powershell
(Invoke-WebRequest -Uri "http://localhost:4040/api/tunnels" -UseBasicParsing).Content
```

Expected public URL: `https://account-subarctic-outrank.ngrok-free.dev`

> If the URL changed (free plan restart), update `apps/web/eas.json` → `build.preview.env.EXPO_PUBLIC_API_URL`
> to `https://<new-url>/api`, then do a **Full Build** (OTA won't pick up env changes).

---

## Step 2A — OTA Update (JS changes only)

Use this for UI tweaks, bug fixes, and logic changes that don't touch native code.

```powershell
cd apps/web
npx eas update --channel preview --message "brief description of changes"
```

The installed APK will receive the update automatically on next launch (background fetch)
or immediately if the user force-closes and reopens the app.

**OTA limitations — requires a Full Build instead if you:**
- Add or remove a package that has native code (e.g., `expo-camera`, `react-native-*`)
- Change `app.json` fields: `permissions`, `plugins`, `scheme`, `icon`, `splash`
- Change `EXPO_PUBLIC_API_URL` (env is baked at build time, not OTA-updatable)
- Bump `version` in `app.json` (changes `runtimeVersion`, old APK stops receiving OTAs)

---

## Step 2B — Full Build (new APK)

Use this for the first release, after native package changes, or env URL changes.

```powershell
cd apps/web
npx eas build --platform android --profile preview --non-interactive
```

- Build runs in the EAS cloud (~10–15 min)
- Download link appears in terminal and at https://expo.dev/accounts/renaldybaskaras-organization/projects/mywallet/builds
- Install the APK on device, then OTA updates work from that point forward

---

## Step 3 — Verify on Device

1. Install APK (or wait for OTA to apply)
2. Open app → check the feature/fix works
3. Check ngrok dashboard at http://localhost:4040 — confirm API requests are reaching your local server

---

## Channels

| Channel | Profile | APK type | `EXPO_PUBLIC_API_URL` |
|---------|---------|----------|-----------------------|
| `preview` | `preview` | APK (sideload) | ngrok URL |
| `production` | `production` | AAB (Play Store) | production domain |

To push an OTA to production:
```powershell
npx eas update --channel production --message "release notes"
```

---

## Common Issues

### "No updates found" on device
- The installed APK was built before `expo-updates` was added → do a Full Build
- Channel mismatch — APK built with `preview` channel only receives `preview` OTA updates

### ngrok "ERR_NGROK_8012" or connection refused
- Docker stack is not running → `docker compose up -d`
- Port 80 is occupied by something else → `netstat -ano | findstr :80`

### EAS build fails — "Project not found"
- Run `npx eas login` and authenticate with `renaldybaskaras-organization` account

### OTA update not applying
- Check `runtimeVersion` in `app.json` matches the installed APK's version
- Force-close and reopen the app (OTA applies on next cold start)
