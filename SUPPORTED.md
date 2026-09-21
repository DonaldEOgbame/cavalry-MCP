# Supported and Tested Compatibility

This document states the project's **measured validation boundary**. It is not a
claim that every Cavalry feature works on every Cavalry version, operating
system, or third-party setup.

## Tested configuration

The following results were measured on **21 September 2026**:

| Area | Verified result |
|---|---:|
| Cavalry | 2.7.2 |
| Host operating system | macOS |
| Registered MCP tools | 340 |
| Callable Cavalry API names | 358 unique / 359 qualified |
| Concrete Cavalry node types | 436 |
| Node attributes | 3,168 |
| Capability groups | 62 |
| Installed render generators | 14 |
| Build/edit/save/reopen/render soak | 100/100 cycles passed |
| Verified real scenes | 26 |
| Verified Knowledge Engine records | 1,641 |
| Unclassified callable or node-schema routes (`UNKNOWN`) | 0 |

All 340 registered tools are accounted for in the live-validation ledger. Of
those, 317 were conservatively counted as live-executed; the remainder are
documented limitations, quarantined dependent routes, or specialized routes
without a valid fixture. All 14 installed render generators were exercised:
12 passed with their expected video/audio behavior, while HEVC and ProRes
produced video without audio.

The generic introspection architecture remains intentional: the project does
not register one MCP tool per node type.

## Known limitations

- **Camera Guides:** guide creation can report success and then terminate the
  Cavalry 2.7.2 host. Dependent guide routes remain quarantined until a safe
  fixture is available.
- **Editable Path animation:** static Editable Path operations work, but the
  morph, keyframe, and resynchronization routes can time out or terminate the
  host.
- **Timeline playback:** shared-process playback can block the bridge. Explicit
  frame previews and renders are the verified alternative.
- **HEVC and ProRes audio:** both generators produce valid video, but Cavalry
  2.7.2 does not expose audio-export attributes for them. Use a validated
  audio-capable format when embedded audio is required.
- **Specialized asset fixtures:** Google Sheets, image sequences, Smart Folders,
  and some dedicated per-handler audio routes do not yet have complete isolated
  fixtures in the all-tool sweep. Related asset and audio workflows are covered
  by broader live acceptance tests.
- **Other operating systems and versions:** Windows bridge installation is
  supported by the project, but the current certification evidence is from
  Cavalry 2.7.2 on macOS only.

These are known, classified boundaries—not `UNKNOWN` coverage gaps.

## Validation evidence

- [Release validation report](docs/release-validation-2026-09-21.md)
- [Coverage report](docs/coverage.md)
- [Callable-surface audit](coverage/cavalry-surface-audit.json)
- [Live MCP tool sweep](coverage/live-mcp-tool-sweep-results.json)
- [100-cycle soak results](coverage/live-soak-results.json)
- [Compatibility results](coverage/live-compatibility-results.json)
- [Render-format results](coverage/render-formats.json)
- [Knowledge coverage matrix](knowledge/generated/knowledge-coverage-matrix.json)

The current release classification is a **conditional release candidate for the
verified generic workflows**, not maximum practical parity. See the release
validation report for the route-by-route counts, quarantine rationale,
persistence coverage, compatibility results, and remaining gaps.
