# Cavalry Model Context Protocol (MCP) Server

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![Cavalry](https://img.shields.io/badge/Cavalry-2.7%2B-purple.svg)](https://cavalry.scenegroup.co/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An introspection-driven **Model Context Protocol (MCP)** server designed to let AI agents (such as **Claude Code**) operate [Cavalry](https://cavalry.scenegroup.co/).

Instead of hard-coding static endpoints or relying on brittle string-interpolated JavaScript, this server dynamically discovers layer types, attribute definitions, and procedural generator slots from the live Cavalry runtime. It enables agents to inspect, construct, animate, preview, visually evaluate, revise, save, and render complete motion-graphics projects autonomously.

The server also includes a Cavalry-specific Knowledge Engine for provenance-aware documentation/API retrieval, normalized real-scene graphs, graph similarity, motion recipes, verified script patterns, scoped failure memory, runtime-aware recommendations, and pre-mutation motion planning. See [docs/knowledge-engine.md](docs/knowledge-engine.md), [docs/knowledge-sources.md](docs/knowledge-sources.md), and [docs/knowledge-refresh.md](docs/knowledge-refresh.md).

---

## Architecture

```text
Claude Code (AI Agent)
       │ (JSON-RPC 2.0 via Stdio)
       ▼
Cavalry MCP Server (TypeScript / Node.js)
       │
       │ HTTP POST (127.0.0.1:8080/post)
       ▼
Local Cavalry Bridge (Cavalry JavaScript UI Script)
       │
       │ api.* / cavalry.*
       ▼
Live Cavalry Scene Graph
```

### Core Features

* **Introspection-Driven**: Dynamically queries `api.getAllLayerTypes()` and `api.getAttributeDefinition()`. Any layer or plugin installed in Cavalry is automatically creatable and editable without changing MCP code.
* **Exact Bézier Curve Control**: Full control over keyframe tangents, handle coordinates, angle/weight locking, and speed/influence velocities.
* **Three-Level Control Model**:
  * **Level 1**: Validated, structured MCP tools (default).
  * **Level 2**: `cavalry_raw_script` escape hatch (guarded by `CAVALRY_ALLOW_RAW_SCRIPT=true`).
  * **Level 3**: Extensibility hooks for future OS-level UI automation.
* **Stable UUID Layer Identities**: Dual-indexing (`uuid` ↔ `layerId`) prevents broken references when layers are reordered or scenes are reloaded.
* **Single Round-Trip Batch Execution**: Fail-fast batch engine with `$symbol` reference resolution across dependent operations.
* **Native Event Stream**: Cavalry application callbacks feed subscribed scene, layer, attribute, asset, selection, tool, licence, and preference events into a bounded queue. Polling those events invalidates MCP caches immediately.
* **Co-edit Conflict Guard**: `events_status` exposes a scene revision. Pass it as `expectedRevision` to `cavalry_batch` to abort with `EDIT_CONFLICT` if a human edited the scene after the operation was planned.
* **Measured Parity**: `cavalry_parity_audit` reports structured, raw-script, UI-fallback, render-format, and manual-editor coverage from the checked-in `coverage/` databases. Known gaps are reported rather than described as 100% complete.
* **Visual Evaluation Loop**: Real-time PNG frame previews, contact-sheet synthesis with burned-in frame badges, and preview video assembly.
* **Security & Sandboxing**: Tiered permission system and canonical filesystem sandboxing preventing path traversal attacks.

---

## Requirements

* **macOS** or **Windows**
* **Node.js** >= 18.0.0
* **Cavalry** >= 2.4.0 (tested on **Cavalry 2.7.2**)
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
| `CAVALRY_SECURITY_TIER` | `SAFE` | `SAFE`, `EXTENDED`, `RAW`, or `SYSTEM_EXEC`. |
| `CAVALRY_ALLOW_RAW_SCRIPT` | `false` | Enables `cavalry_raw_script` tool when `true`. |
| `CAVALRY_ALLOWED_ROOTS` | `""` | Comma-separated list of approved filesystem paths. |
| `CAVALRY_PREVIEW_DIR` | `os.tmpdir()/cavalry-previews` | Output directory for rendered frames and contact sheets. |
| `CAVALRY_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error`. |

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

* [Architecture Specification](docs/architecture.md)
* [Cavalry Scripting API Notes & Introspection Reference](docs/cavalry-api-notes.md)
* [Security & Sandboxing Guide](docs/security.md)
* [Tool Reference](docs/tool-reference.md)
* [Testing & Acceptance Suite](docs/testing.md)
* [Bridge Installation Guide](cavalry/install.md)

---

## License

MIT License. See [LICENSE](LICENSE) for details.
