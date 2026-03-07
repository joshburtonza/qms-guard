# Client Context — Ascend LC (QMS Guard)

## The Business
Ascend LC is a quality management consultancy. QMS Guard is their internal platform for tracking non-conformances (NCs), audits, surveys, and course evaluations across their client base. It's a compliance and quality ops tool, not a public-facing product.

## Key People
- **Riaan Kotze** — primary contact, founder/director
- **André** — co-director / ops

## Platform Overview
- React + TypeScript + Supabase
- Multi-phase build: Phase 1 = NC tracking, Phase 2 = surveys + moderation + course evaluations + audits
- Has "Edith" AI assistant integration (in-app AI helper)
- Role-based access control
- Active development — daily commits as of Feb 2026

## Tone & Communication
- Professional, precise — this is a compliance platform, errors matter
- Riaan is detail-oriented; changes should be well-reasoned
- SA business context: ISO standards, SANAS accreditation environment

## What Matters to Them
- Data integrity — NC records must be accurate and auditable
- User experience for non-technical auditors
- Mobile usability for on-site inspections
- Report generation / exports

## Current Focus (Feb 2026)
- Mobile layout refinements (most recent commits)
- Phase 2 feature rollout

## Payment Status (updated Feb 27, 2026)
- **Feb 2026 retainer: PAID** — R30,000 received. Income entry marked paid in Mission Control.
- Retainer is up to date. No outstanding balance.

## Relationship Status (updated Feb 23, 2026)
- **Riaan's verdict on the overhaul:** "No this is great work Josh! Well done!" — explicitly praised dark/light mode and reports automation
- Flow-wise sign-off given; moving into active play-testing ("make a bunch of notes")
- Face-to-face session is next milestone — Riaan will bring a consolidated list of niggles
- Signed off with "Baie dankie" (Afrikaans) — trust and warmth are high
- **Key insight:** He's stress-testing, not evaluating. The pitch phase is over. This is now delivery.

## Tech Notes
- Check existing component patterns before adding new ones — codebase is consistent
- Supabase RLS is likely enabled — test queries carefully
- Build: `npm run build` in repo root
- Deploy: Lovable-hosted (check if there's a deploy script or if it's auto-deployed)
