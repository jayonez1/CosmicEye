# Changelog

## 0.1.0

Initial release.

### Features

- Duplicate API request detection based on FNV-1a hashing of endpoint + params + body
- Configurable time window for duplicate detection (default: 1 000 ms)
- Deterministic user sampling (~5% in production, always enabled in development)
- User action tracking (`click`, `keydown`, `touchstart`) with `rum-id` attribute support
- Environment snapshot (tab visibility, network effective type)
- Batch flush with multiple triggers: interval, threshold, visibilitychange, pagehide, destroy
- Structured hashing with depth/node/key/array/string limits and truncation flags
- Full TypeScript types for all public interfaces

### Differences from reference implementation

- **Removed**: `mobxSpy` module — MobX is an optional peer concern, not bundled. The `logEntry.mobx` field is typed as `unknown` and can be populated externally
- **Removed**: `window.RDR = this` assignment — consumers should use the exported `rdr` instance directly
- **Added**: `_resetSamplingState()` export from `sampling.ts` for test isolation
- **Changed**: `VERSION` now reads `'0.1.0'` (was `'1.0.0'` in reference)
- **Changed**: `removeEventListener` for actions uses `{ capture: true }` without `passive` (matches browser API for removal)
