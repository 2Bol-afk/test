# PROMPTS.md

> A personal library of every prompt that worked (or didn't). Date, model, intent, prompt, output quality (1-5).

## M1 — Model comparison


## Agents setup 
[AGENTS.md](file:///c:/Users/DTC USER/Desktop/sadiang-abay/neo/test/AGENTS.md) — Update AGENTS.md to prepare project for agentic coding.

---

## Local Teachable Machine Model Integration
**Date:** 2026-06-17  
**Model:** Antigravity (Claude Sonnet)  
**Task Intent:** Wire local Teachable Machine model (`/model/`) to the game runner character. `angry` → JUMP, `sad` → CROUCH, `happy` → NEUTRAL/RUN.  
**Prompt:** "i added the files from teachable machine use the model to control the runner or the character for jump angry and for crouch use the sad"  
**Steps taken:**
- Copied `model/` → `public/model/` so Vite serves files as static assets at `/model/`
- Pre-configured `tmConfig` in `App.tsx` with `modelUrl: '/model/'` and correct emotion mappings
- Added `useEffect` auto-load in `TeachableMachineController` to load model on mount without user input
- Fixed auto-mapper logic so `angry` → jump, `sad` → crouch, `happy` → neutral (previously `angry` was wrongly mapped to crouch)
- Updated UI tips panel to show emoji-labeled emotion controls
- Added `✅ LOCAL MODEL ACTIVE` status badge in controller header
- TypeScript check: **0 errors**

**Output Quality:** 5/5