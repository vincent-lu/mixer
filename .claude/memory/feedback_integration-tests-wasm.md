---
name: feedback-integration-tests-wasm
description: Always write integration tests for WASM/native library integrations — mocks hide real API shapes
metadata:
  node_type: memory
  type: feedback
---

When integrating a WASM/native library, always write an integration test that calls the real library against a real fixture file. Mock-only tests hide module export shapes, return value types (e.g. VectorFloat vs Array), and floating-point precision characteristics.

**Why:** Three bugs shipped in the essentia.js integration — wrong CJS export shape, VectorFloat instead of JS array, and ~0.4992s intervals instead of exact 0.5s — all invisible to mocked tests but caught immediately by an integration test against a real audio file.

**How to apply:** For any new external library integration (especially WASM, native bindings, or FFI), write at least one test that calls the real library with a fixture from `test-assets/`. Mocks should test *your* logic around the library, not substitute for calling it. The two layers complement — integration tests catch API contract issues, mocks enable edge-case coverage.
