# ADR 011: Static hosting choice and commercial-use terms

- **Status:** Proposed — awaiting Anu's approval
- **Date:** 2026-10-20
- **Spec:** 04 §12

## Context

apps/web and apps/studio are static builds; 04 §9 names Vercel or Cloudflare Pages; security headers (CSP, HSTS, etc.) must be set at the edge.

## Decision

**Open — needs Anu.** Recommendation: Cloudflare Pages (free tier permits commercial use; headers via `_headers`; preview deploys per PR; India PoPs). Alternative: Vercel Pro (Hobby plan disallows commercial use).

## Consequences

Decides DNS records for margwise.byteheaven.in and the preview-deploy workflow.

## Alternatives considered

Netlify; Supabase Storage static hosting (no header control).
