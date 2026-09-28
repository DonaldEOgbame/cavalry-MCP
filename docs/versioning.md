# Versioning and compatibility policy

`cavalry-mcp` follows Semantic Versioning.

- Patch: fixes that do not remove or rename tools, request fields, response fields, or bridge behavior.
- Minor: backward-compatible tools, optional schema fields, capabilities, and protocol features.
- Major: removed or renamed tools, newly required schema fields, incompatible response changes, knowledge-schema changes without an automatic migration, or a bridge-protocol break.

Bridge protocol v2 is negotiated on every request. A client rejects a bridge that does not return the same protocol version and tells the operator to reinstall the matching bridge. Optional Cavalry features are reported by `cavalry_capabilities`; callers must use those capability flags instead of assuming a method exists.

The minimum fully tested Cavalry release is 2.7.2. Newer releases are supported after the live compatibility workflow passes; until then they are treated as compatibility candidates rather than silently assumed compatible. Node.js 20, 22, 24, and 26 are both the declared engine range and the release-test matrix.

Releases are produced from `v*` tags by the release workflow. It verifies generated files, documentation, tests, benchmarks, and the actual npm tarball before publishing with npm provenance.
