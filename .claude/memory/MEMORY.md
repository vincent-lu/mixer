# Memory Index

## Feedback
- [Concat escaping](feedback_pre-commit-concat.md) — ffconcat uses single-quote escaping, not double-quote; reviewer was wrong
- [Integration tests for WASM](feedback_integration-tests-wasm.md) — always test real library with real fixtures; mocks hide API contract issues
- [IPC event race](feedback_ipc-event-race.md) — push event handlers must update-only, never add; broadcast arrives before invoke response
- [Mix style priorities](feedback_mix-style-priorities.md) — style is creative intent (playthrough↔hyperkinetic), not a rule; video analysis deferred, user curates inputs
- [xfade timebase](feedback_ffmpeg-xfade-timebase.md) — xfade requires matching timebases; always use settb=AVTB on trimmed segments in filter_complex
- [Worker session reports](feedback_worker-session-reports.md) — concise reports (300 words): hashes, decisions, surprises, watch items. Not re-descriptions.

## Project state
- [PMV_Generator reference](project_reference-pmv-generator.md) — what mixer kept/dropped from the Python predecessor
- [UI wiring](project_ui-wiring.md) — implemented: main-process job runner wires UI to pipeline
- [BPM analysis](project_bpm-analysis.md) — implemented: essentia.js beat detection in Node.js with configurable min gap
- [Audio analysis design](project_audio-analysis-design.md) — complete: 4 sessions + transitions + clip effects + frenetic/chaos styles + configurable lookahead
- [QoL sprint](project_qol-sprint.md) — complete: all 4 items done (vestigial IPC, stale docs, retry, push progress)
- [Batch mode](project_batch-mode.md) — implemented: multi-folder batch job creation with deck-dealing video allocation, queue pause, clear completed
- [Auto style](project_auto-style.md) — implemented: BPM × energy × bias auto-resolves style, transitions, effects
- [Tools tab](project_tools.md) — implemented: MP4→MP3 converter, duplicate BGM finder, video pre-normalizer
- [SAR edge case](project_sar-edge-case.md) — potential: non-square SAR videos skip normalization, may display at wrong ratio
- [Parallel encoding](project_parallel-encoding.md) — idea: split single jobs into N parallel ffmpeg chunks for faster encoding
- [Agent mixer](project_agent-mixer.md) — idea: LLM agent auto-selects BGMs + videos and runs mixes via CLI

## References

## Archive
