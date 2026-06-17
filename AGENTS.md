# AGENTS.md

## What lives here
This repository is built, maintained, and extended with the help of AI coding agents collaborating with human developers. This document acts as the definitive guide and operating manual for any agent interacting with this codebase.

---

## Models in use
- **Gemini (cloud):** Used for advanced code generation, architectural planning, complex debugging, and brainstorming.
- **Gemma 4 2B via Ollama or LM Studio (local):** Used for offline operations, lint checks, and local code reviews.

---

## Responsible AI rules
- **Human Review:** Every model output/PR must be reviewed and approved by a human developer before it is merged into the main branch.
- **Data Privacy:** Never send personal data, credentials, secrets, or proprietary/sensitive code to public or non-compliant external models.
- **Disclosure:** AI assistance must be explicitly disclosed in Pull Request descriptions and documented in the README footer.
- **Verification:** Local models may hallucinate citations or references; always verify facts and citations against source code or documentation.
- **High-Risk Changes:** Modifying authentication, payment systems, or student/user records requires a second human reviewer's explicit sign-off.

---

## Escalation
If a model produces code that looks incorrect, triggers regression, or if you encounter ambiguity in requirements that cannot be resolved automatically: **stop immediately, document the issue, and ask a human for guidance.**

---

## Project Overview & Structure
This is a modern single-page application built with React, TypeScript, and Vite, utilizing Tailwind CSS for styling and Tailwind's Vite plugin for build-time compilation.

### Key Directories & Files
- [src/](file:///c:/Users/DTC USER/Desktop/sadiang-abay/neo/test/src) — Contains the React source code.
  - [src/components/](file:///c:/Users/DTC USER/Desktop/sadiang-abay/neo/test/src/components) — Reusable UI components.
  - [src/lib/](file:///c:/Users/DTC USER/Desktop/sadiang-abay/neo/test/src/lib) — Utility functions, API clients, and shared state libraries.
  - [src/App.tsx](file:///c:/Users/DTC USER/Desktop/sadiang-abay/neo/test/src/App.tsx) — Main application entry and layout setup.
  - [src/index.css](file:///c:/Users/DTC USER/Desktop/sadiang-abay/neo/test/src/index.css) — Main stylesheet importing Tailwind v4.
- [package.json](file:///c:/Users/DTC USER/Desktop/sadiang-abay/neo/test/package.json) — Project dependencies, metadata, and scripts.
- [vite.config.ts](file:///c:/Users/DTC USER/Desktop/sadiang-abay/neo/test/vite.config.ts) — Vite compilation and plugin configuration.
- [tsconfig.json](file:///c:/Users/DTC USER/Desktop/sadiang-abay/neo/test/tsconfig.json) — TypeScript compiler configurations.

---

## Agentic Development Workflow Loop
Agents must adhere to the following lifecycle for every task:

### Phase 1: Planning & Intent Verification
1. Read [TASKS.md](file:///c:/Users/DTC USER/Desktop/sadiang-abay/neo/test/TASKS.md) to locate the next unassigned task under the `## Now (today)` or `## Next` section.
2. Mark the selected task as in-progress by replacing `[ ]` with `[/]`, appending your Agent name (e.g., `[/] TASK-001 — Build settings UI — Agent Antigravity`).
3. Check for any relevant Knowledge Items (KIs) in the environment to avoid redundant work.

### Phase 2: Implementation & Coding Standards
1. **No Placeholders:** Write fully functional, production-ready code. Do not use `// TODO` or temporary stub functions for critical logic.
2. **Maintain Documentation:** Keep existing comments, docstrings, and licensing headers intact unless explicitly asked to modify them.
3. **UI/UX Aesthetics:** Build clean, modern, and accessible user interfaces. Follow the visual guidelines, using Tailwind CSS utility classes and `lucide-react` for icons.
4. **Google Gen AI Integration:** When interacting with Gemini API, use the `@google/genai` SDK and verify that API keys are read securely via environment variables (`process.env` or `import.meta.env`).

### Phase 3: Verification & Compilation
1. Run `npm run lint` (`tsc --noEmit`) to verify that the TypeScript project compiles without any compilation errors.
2. Verify functionality through tests or by ensuring build steps succeed (`npm run build`).
3. Ensure no lint warnings or TS errors are introduced.

### Phase 4: Logging & Completion
1. Log details about the prompts used and model performance in [PROMPTS.md](file:///c:/Users/DTC USER/Desktop/sadiang-abay/neo/test/PROMPTS.md). Include the date, model, task intent, exact prompt, and an output quality rating (1–5).
2. Update the task status in [TASKS.md](file:///c:/Users/DTC USER/Desktop/sadiang-abay/neo/test/TASKS.md) to complete (`[x]`) and note the completion date (e.g., `[x] TASK-001 — Build settings UI — Finished 2026-06-17`).

---

## Communication & Formatting Guidelines
When communicating with human developers, agents must:
- Keep explanations brief, concise, and focused on key architectural choices.
- Always format references to files or symbols as clickable local file links using the `file:///` URI scheme (e.g., [App.tsx](file:///c:/Users/DTC USER/Desktop/sadiang-abay/neo/test/src/App.tsx)).
