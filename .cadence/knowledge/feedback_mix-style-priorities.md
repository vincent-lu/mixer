---
name: feedback-mix-style-priorities
description: Mix style is creative intent (playthrough↔hyperkinetic), not a fixed rule. Video analysis lower priority — user curates input videos manually.
metadata:
  type: feedback
---

Mix style is fully style/mood/BGM dependent — no single "correct" pacing.
- One extreme: straight playthrough of video with minimal cuts
- Other extreme: dizzying fast cuts (particularly for EDM)
- "Don't cut on every beat" research finding is valid for some styles, not a universal rule

**Why:** The user's creative intent drives pacing, not a hardcoded philosophy. The system should offer a spectrum, not prescribe.

**How to apply:** Never hardcode pacing assumptions. Style parameter should cover the full spectrum. When proposing defaults, frame as a starting point the user can slide, not a recommendation.

---

Video-side analysis is lower priority because the user manages video selection manually — choosing input videos that fit the style/BGM/mood.

Input videos come in two types: long continuous scenes (raw footage) and existing mixed/edited videos. Motion analysis, scene detection, etc. work on long scenes but produce garbage on pre-mixed content. Any future video analysis needs to distinguish these two types first.

**Why:** User curates the creative direction through video selection. Automated video analysis is less urgent than better audio analysis and transitions.

**How to apply:** Prioritize audio analysis and transition work over video-side features. When video analysis is eventually tackled, handle the raw-vs-pre-mixed distinction.
