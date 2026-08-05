See @AGENTS.md

- No fallbacks — always prefer explicit code that fails fast over silently
  falling back to an alternative behavior
- Prefer functional, DRY, clean code
- Prefer Playwright E2E tests over unit tests

## Mobile First

- Design for the smallest screen first; write base styles for mobile and
  enhance for larger screens with `@media (min-width: ...)` queries — never
  the reverse
- Use responsive layouts (flex/grid, relative units, `max-width`) instead of
  fixed pixel widths and heights
- Present data as vertical lists/cards, not wide multi-column tables or
  desktop grid widgets
- Every action must work with touch: provide tap alternatives for
  drag-and-drop or hover-only interactions, with tap targets at least 44px
- Respect `env(safe-area-inset-*)` in edge-to-edge/PWA layouts
- Cover mobile in Playwright tests: run key flows at a phone viewport
  (390×844) and assert there is no horizontal overflow
