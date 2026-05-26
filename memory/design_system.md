---
name: design-system
description: The "Candy Atelier" visual language adopted in the full frontend redesign
metadata:
  type: project
---

Full visual redesign chosen by the user (May 2026): keep React19/Vite/
Tailwind + the CSS-variable token architecture (so it cascades), evolve
the brand — do NOT migrate frameworks.

**Direction: "Candy Atelier" — glossy confectionery, crisp editorial.**
- Tokens redefined in `src/index.css` `:root` (light "Sugar Glass") and
  `.dark` ("Licorice Neon"). Same token *names* as before → cascades.
  New tokens: `--color-grape`, `--candy-gloss*`, `--sticker-*`.
- Signature surface utilities in `src/index.css`: `.sticker` (chunky
  inked border + hard offset shadow, jelly-press on hover/active),
  `.candy-gloss` (specular sheen ::after), `.gumdrop` (glossy pill),
  `.candy-grain`.
- `tailwind.config.js`: added `grape` color, richer `candy-gradient`
  (raspberry→grape→mint), `candy-conic`, `sheen`/`spin-slow` anims.
- Display font Fredoka (`font-candy`), body Quicksand (`font-body`),
  mono Fira Code — already loaded, kept.

**Done & browser-verified (light + Licorice-Neon dark):** tokens +
surfaces; Hero, Sidebar (the REAL chrome — `layout/Sidebar.tsx`, not
Header), executor modal (`skill-creator/SkillExecutor.tsx`) rebuilt
token-driven. Root cause of the "很不正常" was found & fixed: `.glass`
/`.candy-gradient*` helper classes in `index.css` were hardcoded to the
OLD warm-brown palette → made token-driven (`color-mix` on tokens).
`Layout.tsx` THEME_COLORS `rose` default realigned to new raspberry.
Unified confectionery **category palette** across SkillsGrid /
EditorPicks / PostCandyModal (sky/fuchsia/orange/teal/violet/cyan/
lime/amber). Executor shows a "● Warm · ready" gumdrop = the
Claude-Code instant-feel cue; Claude Code is the default runtime.

`playwright` added as devDep for visual QA (screenshot scripts are
throwaway, not committed). `Header.tsx` exists but is NOT rendered
(Layout uses Sidebar) — dead, safe to delete later.

Backend still needs the user to deploy (Docker + CF creds + 2 secrets);
see [[agent-architecture]] and `agent/README.md`.
