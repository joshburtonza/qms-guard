# QMS Guard — Claude Instructions

## Before Every Deploy

Run PR review agents on changed files before `vercel --prod --force`:
1. `pr-review-toolkit:code-reviewer` — always
2. `pr-review-toolkit:silent-failure-hunter` — always
3. `pr-review-toolkit:code-simplifier` — after fixes

Fix critical issues before deploying.

## Stack
- React + TypeScript + Vite + Tailwind + shadcn/ui
- Supabase project: `yjvnmablxeknprqplale` (Josh's account — full programmatic access)
- Run migrations via Management API: `curl -X POST "https://api.supabase.com/v1/projects/yjvnmablxeknprqplale/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -d '{"query":"..."}'`
- Credentials in `.env.scheduler`: `QMS_SUPABASE_URL`, `QMS_SERVICE_ROLE_KEY`, `QMS_DB_PASSWORD`
- Edge functions: deploy via Supabase dashboard only (no CLI access)
- Deploy: `vercel --prod --force` from this directory

## Key Rules
- Mobile-first: auditors use this on-site on phones. NC form especially.
- Compliance platform — data integrity matters. Be conservative with any data-touching changes.
- Check `src/pages/ReportNC.tsx` is touch-friendly after any layout changes.
- Supabase RLS is enabled — test queries carefully, wrong policies = silent empty results.
