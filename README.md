# Cavalry Model Context Protocol (MCP) Server

[![TypeScript](https://img.shields.io/badge/TypeScript-7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%20%7C%2022%20%7C%2024%20%7C%2026-green.svg)](https://nodejs.org/)
[![Cavalry](https://img.shields.io/badge/Cavalry-2.7.2%20tested-purple.svg)](https://cavalry.scenegroup.co/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An introspection-driven **Model Context Protocol (MCP)** server designed to let AI agents (such as **Claude Code**) operate [Cavalry](https://cavalry.scenegroup.co/).

Instead of hard-coding static endpoints or relying on brittle string-interpolated JavaScript, this server dynamically discovers layer types, attribute definitions, and procedural generator slots from the live Cavalry runtime. It enables agents to inspect, construct, animate, preview, visually evaluate, revise, save, and render complete motion-graphics projects autonomously.

The server also includes a Cavalry-specific Knowledge Engine for provenance-aware documentation/API retrieval, normalized real-scene graphs, graph similarity, motion recipes, verified script patterns, scoped failure memory, runtime-aware recommendations, and pre-mutation motion planning. See [docs/knowledge-engine.md](docs/knowledge-engine.md), [docs/knowledge-sources.md](docs/knowledge-sources.md), and [docs/knowledge-refresh.md](docs/knowledge-refresh.md).

---

## Tested Compatibility

Measured on **Cavalry 2.7.2 for macOS** and refreshed on 27 September 2026:

| Validation boundary | Result |
|---|---:|
| Registered MCP tools | 403 (59 in the default production profile) |
| Concrete node types | 436 |
| Node attributes | 3,168 |
| Installed render generators | 14 |
| Build/edit/save/reopen/render soak | 500/500 cycles passed |
| Verified real scenes | 75 |
| Verified Knowledge Engine records | 1,700 of 1,701 |
| Unclassified callable or node-schema routes (`UNKNOWN`) | 0 |
| Disposable live acceptance | 22/22 |
| Large-scene stress | 1,000 layers, 2,000 keyframes, transactional rollback |

Native Camera Guides, native Editable Path morph/keyframe routes, shared-process
timeline playback, and native HEVC/ProRes audio export remain Cavalry 2.7.2
limitations. Verified safe alternatives now cover camera sequencing, sampled
path animation, rendered timeline previews, and FFmpeg audio muxing. Generic
tags, presets, native file dialogs, and third-party custom UI remain platform
limitations. Windows installation is available, but the current certification
evidence is macOS-only.

See **[SUPPORTED.md](SUPPORTED.md)** for the exact scope and limitations, and
the [release validation report](docs/release-validation.md) for the
underlying live-test evidence. This project reports measured coverage, not a
claim of universal or maximum practical parity.

---

## Architecture

```text
MCP-capable AI client
       │ JSON-RPC 2.0 over stdio
       ▼
High-level motion/project compiler tools
       │ declarative project and scene manifests
       ▼
Cavalry MCP Server (typed compilation, batching, verification, QC)
       │ authenticated loopback HTTP (internal only)
       ▼
Local Cavalry Bridge → Cavalry API → editable scene graph
```

The loopback bridge is an authenticated internal transport. MCP clients should connect through stdio and must not call the bridge endpoint directly.

### Core Features

* **Introspection-Driven**: Dynamically queries `api.getAllLayerTypes()` and `api.getAttributeDefinition()`. Any layer or plugin installed in Cavalry is automatically creatable and editable without changing MCP code.
* **Exact Bézier Curve Control**: Full control over keyframe tangents, handle coordinates, angle/weight locking, and speed/influence velocities.
* **Layered Control Model**:
  * **Level 1**: Validated, structured MCP tools (default).
  * **Level 2**: `cavalry_raw_script` escape hatch (guarded by `CAVALRY_ALLOW_RAW_SCRIPT=true`).
  * **Level 3**: Optional Command Search, shortcut, and macOS Accessibility driver for editor-only controls (`CAVALRY_UI_DRIVER=true`).
  * **Recovery**: Risk-classified host supervision with checkpoint, timeout, bridge-health verification, optional Cavalry restart, and checkpoint restoration (`CAVALRY_WATCHDOG_AUTO_RESTART=true`).
* **Stable UUID Layer Identities**: Dual-indexing (`uuid` ↔ `layerId`) prevents broken references when layers are reordered or scenes are reloaded.
* **Single Round-Trip Batch Execution**: Fail-fast batch engine with `$symbol` reference resolution across dependent operations.
* **Declarative Motion Compiler**: Whole projects, scenes, typography systems, reusable components, transitions, corrections, review frames, and renders are expressed through high-level typed tools and compiled into internal batches. See [docs/motion-compiler.md](docs/motion-compiler.md).
* **Native Event Stream**: Cavalry application callbacks feed subscribed scene, layer, attribute, asset, selection, tool, licence, and preference events into a bounded queue. Polling those events invalidates MCP caches immediately.
* **Co-edit Conflict Guard**: `events_status` exposes a scene revision. Pass it as `expectedRevision` to `cavalry_batch` to abort with `EDIT_CONFLICT` if a human edited the scene after the operation was planned.
* **Measured Parity**: `cavalry_parity_audit` reports structured, raw-script, UI-fallback, render-format, and manual-editor coverage from the checked-in `coverage/` databases. Known gaps are reported rather than described as 100% complete.
* **Visual Evaluation Loop**: Real-time PNG frame previews, contact-sheet synthesis with burned-in frame badges, and preview video assembly.
* **Security & Sandboxing**: Tiered permission system and canonical filesystem sandboxing preventing path traversal attacks.

---

## Requirements

* **macOS** or **Windows**
* **Node.js** 20, 22, 24, or 26
* **Cavalry 2.7.2** (newer versions remain compatibility candidates until the live matrix passes)
* *(Optional)* **FFmpeg** on system PATH for compiling MP4 preview videos (fallback uses image sequences).

---

## Installation

### 1. Clone & Build Server

```bash
git clone https://github.com/DonaldEOgbame/calvary-MCP.git
cd calvary-MCP
npm install
npm run build
```

### 2. Install the Cavalry Bridge Script

Copy the bridge script into Cavalry's User Scripts directory:

**macOS**:
```bash
mkdir -p ~/Library/Application\ Support/Cavalry/Scripts
cp cavalry/bridge.js ~/Library/Application\ Support/Cavalry/Scripts/CavalryBridge.js
```

**Windows**:
```powershell
copy cavalry\bridge.js "%APPDATA%\Cavalry\Scripts\CavalryBridge.js"
```

### 3. Activate the Bridge in Cavalry

On macOS, run `npm run bridge:launch` to install, open Cavalry, and activate the bridge automatically (Accessibility permission is required). For manual activation:

1. Launch **Cavalry**.
2. Go to the menu bar: **Scripts > CavalryBridge**.
3. A status window titled **Cavalry MCP Bridge** will open:
   ```text
   ● Listening on 127.0.0.1:8080
   Requests: 0
   Bridge v1.0.0 | Autonomous Operator
   ```
4. Keep this window open during AI editing sessions.

---

## Connecting to Claude Code

Add the Cavalry MCP server to your Claude Code or Claude Desktop configuration:

### Claude Code (`~/.claude.json` or project `.mcp.json`)

```json
{
  "mcpServers": {
    "cavalry": {
      "command": "node",
      "args": [
        "/Users/macbook/Documents/GitHub/calvary-MCP/dist/index.js"
      ],
      "env": {
        "CAVALRY_BRIDGE_HOST": "127.0.0.1",
        "CAVALRY_BRIDGE_PORT": "8080",
        "CAVALRY_SECURITY_TIER": "SAFE",
        "CAVALRY_ALLOW_RAW_SCRIPT": "false"
      }
    }
  }
}
```

Or run directly via `tsx` during development:

```json
{
  "mcpServers": {
    "cavalry": {
      "command": "npx",
      "args": [
        "tsx",
        "/Users/macbook/Documents/GitHub/calvary-MCP/src/index.ts"
      ]
    }
  }
}
```

---

## Configuration

Configuration can be set via environment variables or a `.env` file in the project root:

| Variable | Default | Description |
|---|---|---|
| `CAVALRY_BRIDGE_HOST` | `127.0.0.1` | IP address for Cavalry WebServer. |
| `CAVALRY_BRIDGE_PORT` | `8080` | Port for Cavalry WebServer. |
| `CAVALRY_CALLBACK_PORT` | `8082` | Port for ultra-low latency MCP receiver. |
| `CAVALRY_BRIDGE_TIMEOUT_MS` | `15000` | Bridge request timeout (ms). |
| `CAVALRY_RENDER_TIMEOUT_MS` | `1800000` | Deadline before an unverified background render becomes `FAILED`. |
| `CAVALRY_TOOL_PROFILE` | `core` | Production compiler/knowledge/health surface (59 tools); use `standard` for broad typed editing or `full` for all 403 tools. |
| `CAVALRY_SECURITY_TIER` | `SAFE` | `SAFE`, `EXTENDED`, `RAW`, or `SYSTEM_EXEC`. |
| `CAVALRY_ALLOW_RAW_SCRIPT` | `false` | Enables `cavalry_raw_script` tool when `true`. |
| `CAVALRY_DATA_DIR` | platform user-data directory | Writable knowledge and application data; package resources remain read-only. |
| `CAVALRY_UI_DRIVER` | `false` | Enables optional Command Search, shortcut, and macOS Accessibility tools. |
| `CAVALRY_WATCHDOG_AUTO_RESTART` | `false` | Allows supervised host recovery to restart Cavalry and relaunch the bridge on macOS. |
| `CAVALRY_ALLOWED_ROOTS` | `""` | Comma-separated list of approved filesystem paths. |
| `CAVALRY_PREVIEW_DIR` | `os.tmpdir()/cavalry-previews` | Output directory for rendered frames and contact sheets. |
| `CAVALRY_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error`. |

Initialize the writable Knowledge Engine overlay deterministically with `npm run knowledge:init`. The packaged 1,701-record public seed remains read-only; project/private additions are written only to the user-data store.

Run `npm run doctor -- --require-live` for one actionable check of Node, package files, seed integrity, Cavalry/bridge authentication and protocol, temporary paths, fonts, permissions, FFmpeg/FFprobe, and render availability.

---

## Example Autonomous Prompts

### Example 1: Kinetic Title Sequence
> "Create a 1920×1080 composition at 30fps lasting 5 seconds. Add a dark charcoal background. In the center, create the headline 'AUTONOMOUS DESIGN' using Inter Bold at 80pt in white. Add a procedural per-character entrance starting at frame 15 with a 2-frame stagger and SlowOut easing. Below it, add the subtitle 'Built with Cavalry MCP' in cyan with a slide-in transition. Render a contact sheet at frames 0, 15, 30, 45, and 60 to visually evaluate alignment, and save the scene file."

### Example 2: Procedural Motion Graphics
> "Inspect the active composition. Create an ellipse shape and connect it to a duplicator using a circle distribution with count 12. Connect an oscillator to rotate the duplicator continuously. Center everything, render frame 30 as a preview, and verify the resulting layer hierarchy."

### Example 3: Font Replacement Across Scene
> "Inspect the current scene. Find every text layer using Arial, replace the font with Neue Haas Grotesk, preserving the font sizes, positions, and animation curves. Render a contact sheet before and after to verify."

---

## Testing

Run unit and bridge tests:
```bash
npm test
```

Run the external stdio production benchmark (55 scenes, 3,120 frames, 2,095
keyframes) in deterministic dry-run mode:

```bash
npm run benchmark:motion
```

Use `npm run benchmark:motion:live` for live compile/verification/QC/correction
and `npm run benchmark:motion:render` for the full H.264 acceptance boundary.

Regenerate the installed Cavalry API manifest (all four shipped metadata catalogs):

```bash
npm run coverage:api
```

The generated report must keep `Unexplained API functions: 0`. A method routed only through the guarded raw-script escape hatch is counted separately from a direct bridge implementation.

Run the 22 mandatory acceptance tests against live Cavalry:
```bash
npm run test:integration
```

---

## Documentation

* [Supported Compatibility and Known Limitations](SUPPORTED.md)
* [Release Validation Report](docs/release-validation.md)
* [Historical Release Reports](docs/history/)
* [Architecture Specification](docs/architecture.md)
* [Cavalry Scripting API Notes & Introspection Reference](docs/cavalry-api-notes.md)
* [Security & Sandboxing Guide](docs/security.md)
* [Tool Reference](docs/tool-reference.md)
* [Testing & Acceptance Suite](docs/testing.md)
* [Bridge Installation Guide](cavalry/install.md)

---

## License

MIT License. See [LICENSE](LICENSE) for details.
