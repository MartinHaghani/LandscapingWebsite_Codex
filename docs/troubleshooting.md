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

## 8) Quote Submit Shows "Unable to Reach the API"

### Symptom
- Quote submit on `/instant-quote/summary` does not advance.
- The page reports it cannot reach the API, or older builds show a generic `Quote request failed.`

### Root Cause
- The frontend posts draft quotes to `http://localhost:4000` by default.
- The API server is not running, or the frontend is on a different local origin than the API allows.

### Verify
```bash
curl -sS http://localhost:4000/api/health
lsof -nP -iTCP:4000 -sTCP:LISTEN
```

### Fix
1. Start the API with `npm --prefix server run dev`.
2. Confirm the public app points to the same API URL in `client/.env`.
3. If Vite moved to a different loopback port, restart the frontend after updating env if needed. The API now reflects loopback origins across arbitrary local ports.

## 9) Business Email Delivered To Spam

### Symptom
- Messages from `@autoscape.ca` land in customer spam/junk folders.
- Approved quote emails may send successfully from the app, but human business email still has poor inbox placement.

### Current DNS/Auth State
- `autoscape.ca` MX points to Google Workspace.
- Root SPF exists and authorizes Google Workspace through `_spf.google.com`.
- DMARC exists at `_dmarc.autoscape.ca` with `p=quarantine`.
- Resend reports `autoscape.ca` as verified for app quote emails, and `send.autoscape.ca` has the Resend/SES return-path SPF and MX records.
- Google Workspace DKIM is not currently published at the common selectors checked for this domain, including `google._domainkey.autoscape.ca`.

### Most Likely Cause
Google Workspace outbound mail is missing domain-aligned DKIM signing. SPF can still pass for Google mail, but Gmail/Yahoo and other receivers increasingly use DKIM, DMARC alignment, complaint rate, and domain reputation together. Missing DKIM is a common spam-placement signal, especially on newer business domains or domains with strict DMARC.

### Fix
1. In Google Admin Console, go to `Apps > Google Workspace > Gmail > Authenticate email`.
2. Select `autoscape.ca`.
3. Generate a new DKIM record:
   - key length: `2048`
   - selector/prefix: `google`
4. In GoDaddy DNS, add the TXT record Google provides:
   - host/name: `google._domainkey`
   - value: starts with `v=DKIM1; k=rsa; p=...`
5. Wait for DNS propagation, then return to Google Admin Console and click `Start authentication`.
6. Send a new external test email to a Gmail or Yahoo mailbox and inspect headers. Expected results:
   - `spf=pass`
   - `dkim=pass`, with `d=autoscape.ca`
   - `dmarc=pass`

### Verification Commands
```bash
dig +short MX autoscape.ca
dig +short TXT autoscape.ca
dig +short TXT _dmarc.autoscape.ca
dig +short TXT google._domainkey.autoscape.ca
dig +short TXT send.autoscape.ca
dig +short MX send.autoscape.ca
```

### Ongoing Deliverability Notes
- Keep exactly one root SPF TXT record. If a new sender is added, merge its include into the existing SPF record instead of adding a second `v=spf1` TXT.
- Keep transactional quote emails on Resend and human mailbox traffic on Google Workspace; do not route ad hoc campaigns through the contact mailbox.
- For promotional or marketing email, use a provider that supports one-click unsubscribe headers and suppression lists before sending campaigns.
- Monitor Google Postmaster Tools once there is enough Gmail volume to show reputation and spam-rate data.
