---
name: project-agent-mixer
description: "Idea: LLM agent that auto-selects BGMs + source videos and runs mixes via CLI with minimal human input"
metadata:
  type: project
---

LLM-based agent that orchestrates the mixer CLI to produce video mixes with minimal human input.

**Concept:** User provides a library of BGMs and source videos + a creative brief (vibe, style, preferences). Agent reasons about genre/mood matching, selects pairings, picks style settings, and composes `pnpm mix` commands.

**Why it works:** The mixer's CLI-first architecture means the Electron UI is just one frontend. An agent is another frontend that composes the same commands.

**Selection problems the agent would solve:**
- BGM ↔ video mood matching (EDM → high-energy clips, ballad → calm footage)
- Style selection per track (hyperkinetic for drops-heavy EDM, relaxed for ambient)
- Variety across a batch (don't reuse the same clips with every track)
- Transition preferences by genre

**Status:** Idea only. Not scoped, not designed.

**Why:** Automates the creative curation step that currently requires manual selection of BGMs, videos, and settings per job.

**Extended vision — full automated music video production:**
- Analyze input video content/mood → generate a song (lyrics + music via Suno/Udio API or browser automation) → mix video to generated song → generate synced subtitle file (lyrics → SRT/ASS). Each step feeds the next. The LLM is the creative director across the whole pipeline. Very future, depends on music generation API access.

**How to apply:** Future work. Depends on the mixer CLI being stable and feature-complete enough that the agent's only job is selection, not workarounds.
