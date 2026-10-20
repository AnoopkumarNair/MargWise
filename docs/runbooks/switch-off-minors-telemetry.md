# Runbook: Switch off minors' telemetry globally

- **Status:** draft (mechanism exists since Phase 1; Studio toggle in Phase 8)
- **Owner:** Anu
- **Why:** 04 §6.3 — by 13 May 2027 minors' tracking must be switchable off by configuration, with no code change.

## Steps

1. In the Supabase SQL editor of the target project (staging first), run:
   ```sql
   update telemetry.settings set value = 'false', updated_at = now()
   where key = 'minors_telemetry_enabled';
   ```
2. Ship the app config flag `minorsTelemetryEnabled: false` with the next
   static deploy (the SDK then sends nothing even before a server round-trip).

## Verify

- `POST /telemetry/v1/events` returns `403 {"error":"telemetry_disabled"}`.
- New rows stop appearing in `telemetry.events`.
- Clients that receive a 403 drop to Tier 0 and clear their local queue
  (telemetry-sdk test: "a 403 from the server switches the session to Tier 0").
- Deletion requests still work (D-008).

## Roll back

Set the value back to `'true'`. Families must consent again; nothing is resent.
