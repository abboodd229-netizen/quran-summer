---
name: stability-policy
description: Mandatory development policy — project is stable, changes must be minimal, backward-compatible, and batched
metadata:
  type: feedback
---

The project is in STABILIZATION phase. Every change must be:
- Backward compatible
- No DB migration unless absolutely necessary
- No breaking API changes
- No UI regressions
- No performance regression

Mandatory workflow per feature:
1. Read existing implementation first
2. Reuse existing components — never rewrite working code
3. Implement the SMALLEST possible change
4. Run full build pipeline
5. Fix every error before continuing
6. Never implement multiple unrelated features simultaneously

If a change risks destabilizing: STOP, explain risk, suggest safer alternative.

**Why:** User explicitly enforced this before any implementation began (June 2026).
**How to apply:** Before writing any code, ask "is this the smallest change that achieves the goal?"
