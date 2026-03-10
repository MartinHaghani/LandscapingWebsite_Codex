# Troubleshooting Guide

## 1) Command Sessions Saturated / Checks Appear Hung

### Symptom
- Repeated warning:
  - `maximum number of unified exec processes ...`
- `npm run lint`, `npm run test`, or `vite build` starts but appears stalled.

### Root Cause
- Too many old shell sessions/processes were left open.
- New command output becomes delayed or starved.

### Recovery
1. Reuse one interactive shell session for all commands.
2. Kill stale build/test processes:
```bash
pkill -f "node .*tsc" || true
pkill -f "vitest run" || true
pkill -f "vite build" || true
pkill -f "npm exec vite build" || true
```
3. Run checks sequentially (not parallel).

### Notes for Agents
- In this repo/environment, `git status` may take noticeable time while refreshing index. Let it finish before assuming a hang.
- Prefer one persistent shell session for verification and long-running dev servers.

## 2) Wrong Frontend Served (5173 vs 5182 or Stale Dist)

### Symptom
- `127.0.0.1:5173` shows old UI, while another port is blank.
- Toolbar/layout changes appear missing even after code edits.

### Root Cause
- Multiple frontend servers are running with different roots (`client/dist`, temp bundle paths, old Vite process).

### Verify
```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
lsof -nP -iTCP:5182 -sTCP:LISTEN
ps -p <PID> -o pid,ppid,command
```

### Fix
1. Stop stale frontend processes.
2. Start one canonical frontend process only.
3. Hard refresh browser (`Cmd+Shift+R`).

## 3) Tailwind Looks Broken / UI Appears Generic

### Symptom
- Typography/buttons look default.
- Layout appears unstyled or left-aligned.

### Root Cause
- Browser is loading stale or mismatched CSS/JS bundle.
- Wrong static server target or cached assets.

### Verify
```bash
curl -sS http://127.0.0.1:5173/ | sed -n '1,40p'
curl -I http://127.0.0.1:5173/assets/index.css
curl -I http://127.0.0.1:5173/assets/index.js
```

### Fix
1. Restart frontend process.
2. Ensure only one server is listening on target port.
3. Hard refresh browser.

## 4) Blank White Page

### Symptom
- Route returns `200` but screen is blank.

### Likely Causes
- JS runtime error from stale bundle.
- Wrong frontend process serving old assets.
- Missing build-time env replacement in manually bundled output.

### Checks
```bash
curl -sS http://127.0.0.1:5173/ | head -n 20
curl -sS http://127.0.0.1:4000/api/health
```

If using manual bundling, verify `VITE_MAPBOX_TOKEN` and `VITE_API_BASE_URL` are injected.

## 5) Instant Quote Map Disabled (Token Warning)

### Symptom
- Step 2 shows:
  - `` `VITE_MAPBOX_TOKEN` is missing... ``

### Root Cause
- `client/.env` missing token, or frontend process started before env update.

### Fix
1. Set `VITE_MAPBOX_TOKEN` in `client/.env`.
2. Restart frontend process.

## 6) Vite Hangs On First Request / PostCSS Config Error

### Symptom
- Vite prints `ready`, but browser/curl requests to `127.0.0.1:5173` hang with no bytes returned.
- Terminal eventually shows:
  - `Failed to load PostCSS config ... ECANCELED: operation canceled, read`

### Root Cause
- PostCSS config loading failed in local runtime, which blocked request handling.

### Fix Applied
1. Replace CommonJS PostCSS config with ESM config:
   - delete `client/postcss.config.cjs`
   - create `client/postcss.config.mjs`
2. Restart frontend process after config change.

### Verification
```bash
curl -sS --max-time 5 http://127.0.0.1:5173/ | head -n 20
```

## 7) Step 2 Geometry Behavior Clarification

Current expected behavior:
- No auto-reconstruction of self-intersections.
- Warning shown:
  - `Overlapping boundary edges detected. Adjust vertices to continue.`
- Add Obstacle draws red polygon and subtracts overlap from service geometry.
- If obstacles fully remove service area, submit is blocked.

If behavior differs from above, verify that the running frontend process is loading the latest source/bundle.
