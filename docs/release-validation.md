# Cavalry MCP Release Validation

Current as of 27 September 2026.

## Automated validation

- TypeScript build: PASS.
- Unit and bridge contract suite: 55/55 PASS.
- Complete tool-registration contract: 385 unique runtime definitions with schemas and handlers.
- Full-source coverage instrumentation: 72.28% lines across intended production modules (15% enforced floor).
- Package validation: PASS; 259 allowlisted entries, public 1,701-record knowledge seed and MIT license included, local artifacts excluded.
- Production dependency audit: 0 known vulnerabilities.
- Bridge JavaScript syntax and documented Cavalry API contract: PASS.

## Live boundary

The last completed Cavalry 2.7.2/macOS acceptance evidence is archived in [the 22 September report](history/release-validation-2026-09-22.md). The current security and transport changes require a fresh disposable-scene acceptance run before publishing a release. CI provides a separate, manually dispatched `live-acceptance` job for a self-hosted macOS runner with Cavalry installed.
