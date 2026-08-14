---
name: feedback-worker-session-reports
description: Worker session reports should be concise (under 300 words) — commit hashes, autonomous decisions, surprises, watch items. Not re-descriptions of the prompt.
metadata:
  type: feedback
---

When orchestrating work across fresh sessions via opening prompts, ask worker sessions for concise reports:
1. Commit hash(es) and files changed (list only)
2. Decisions made beyond what the prompt specified
3. Anything that didn't go as planned or surprised
4. Watch items for future sessions
5. Typecheck and test status (pass/fail + count)
6. Key validation numbers if applicable (one-liner, not full tables)

Under 300 words. Don't re-describe what the prompt asked for — focus on what the orchestrator doesn't already know.

**Why:** Early reports were ~800 words with detailed tables. The orchestrator verifies code directly anyway (trust but verify), so narrative re-descriptions and full test/validation tables are noise. What the orchestrator actually needs: commit hash to verify, autonomous decisions to review, surprises to assess, and watch items to carry forward.

**How to apply:** Include this report format instruction at the end of every worker session opening prompt.
