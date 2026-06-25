# Memory Index

## Feedback
- [Concat escaping](feedback_pre-commit-concat.md) — ffconcat uses single-quote escaping, not double-quote; reviewer was wrong
- [Integration tests for WASM](feedback_integration-tests-wasm.md) — always test real library with real fixtures; mocks hide API contract issues
- [IPC event race](feedback_ipc-event-race.md) — push event handlers must update-only, never add; broadcast arrives before invoke response

## Project state
- [PMV_Generator reference](project_reference-pmv-generator.md) — what mixer kept/dropped from the Python predecessor
- [UI wiring](project_ui-wiring.md) — implemented: main-process job runner wires UI to pipeline
- [BPM analysis](project_bpm-analysis.md) — implemented: essentia.js beat detection in Node.js with configurable min gap
- [QoL sprint](project_qol-sprint.md) — complete: all 4 items done (vestigial IPC, stale docs, retry, push progress)

## References

## Archive
