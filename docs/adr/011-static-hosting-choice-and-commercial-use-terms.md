# ADR 011: Static hosting choice and commercial-use terms

- **Status:** Accepted (Anu, 2026-10-20)
- **Date:** 2026-10-20
- **Spec:** 04 §12

## Context

apps/web and apps/studio are static builds; 04 §9 names Vercel or Cloudflare Pages; security headers (CSP, HSTS, etc.) must be set at the edge.

## Decision

Cloudflare Pages for both apps, set up like fire.byteheaven.in: production on `margwise.byteheaven.in` and `studio.margwise.byteheaven.in`, preview deploys per PR, security headers via `_headers`. Commercial-use terms to be re-checked before charging money.

## Consequences

Decides DNS records for margwise.byteheaven.in and the preview-deploy workflow.

## Alternatives considered

Netlify; Supabase Storage static hosting (no header control).
