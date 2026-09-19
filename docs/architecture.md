# Cavalry MCP System Architecture

## 1. System Overview

The **Cavalry Model Context Protocol (MCP)** server provides an autonomous operational interface between AI agents (specifically **Claude Code**) and **Cavalry**, the 2D procedural motion-design application.

Rather than acting as a static set of manually hard-coded endpoints, this system is designed as an **introspection-driven autonomous operator**. It leverages Cavalry's dynamic runtime introspection APIs to discover layer types, attribute schemas, connection rules, and generator capabilities on the fly.

### End-to-End Execution Flow

```text
Claude Code (AI Agent)
       │ (JSON-RPC 2.0 via Stdio Transport)
       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cavalry MCP Server                        │
│                   (Node.js / TypeScript)                    │
│                                                             │
│  ┌─────────────────┐ ┌────────────────┐ ┌────────────────┐  │
│  │   MCP Tools     │ │  Permissions   │ │   Filesystem   │  │
│  │   & Schemas     │ │    Sandbox     │ │    Sandbox     │  │
│  └────────┬────────┘ └────────────────┘ └────────────────┘  │
│           │                                                 │
│  ┌────────▼────────┐ ┌────────────────┐ ┌────────────────┐  │
│  │  Batch & Symbol │ │ Introspection  │ │   Preview &    │  │
│  │    Resolver     │ │ Capability Hub │ │ Contact Sheets │  │
│  └────────┬────────┘ └────────────────┘ └────────────────┘  │
│           │                                                 │
│  ┌────────▼──────────────────────────────────────────────┐  │
│  │       Bridge Client (Request Queue & Correlation)      │  │
│  └────────────────────────┬───────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────────┘
                            │ HTTP POST (127.0.0.1:8080/post)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Local Cavalry Bridge UI                     │
│                  (cavalry/bridge.js)                        │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │      api.WebServer (High-frequency 60Hz Poller)       │  │
│  └────────────────────────┬──────────────────────────────┘  │
│                           │                                 │
│  ┌────────────────────────▼──────────────────────────────┐  │
│  │       Dispatcher & Modular Request Handlers           │  │
│  └────────────────────────┬──────────────────────────────┘  │
│                           │ Calls api.* / cavalry.*         │
│  ┌────────────────────────▼──────────────────────────────┐  │
│  │         Live Cavalry Engine & Active Scene Graph      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Comparison with Prior Implementations

Prior implementations (such as `kacperchlebowicz/cavalry-mcp`) operated as basic thin wrappers:
1. **Unsafe JavaScript String Interpolation**: Code strings were built by interpolating parameters (`api.create("${type}", "${name}")`), leading to syntax errors, escaping bugs, and security hazards.
2. **Missing Return Payloads**: Stallion's `onPost` handler in older scripts only wrote messages to `console.log()`. As a result, operations like `cavalry_get_attribute` or `cavalry_create_layer` could not return evaluated values or layer IDs back to the MCP server.
3. **Hard-coded Layer Ecosystem**: Only a fixed whitelist of layer types was exposed; newly installed plugins or unmapped procedural nodes were inaccessible.
4. **No Tangent & Curve Control**: Bezier curves were restricted to generic easing presets without access to in/out tangent coordinates, angles, or weight locking.
5. **No Visual Preview Pipeline**: No native contact-sheet synthesis, no resolution scaling, and no agent evaluation loops.
6. **No Batching**: Constructing an animation required dozens of sequential round trips over HTTP.

### Key Architectural Differences in This Production Server

| Capability | Legacy MCP Server | This Production Architecture |
|---|---|---|
| **Control Model** | String-interpolated scripts sent to Stallion | Three-level control model with validated typed payloads |
| **Bridge Protocol** | Fire-and-forget HTTP POST with unparsed responses | Correlated request/response protocol with return values |
| **Introspection** | Static predefined strings | Dynamic runtime discovery (`getAllLayerTypes`, `getAttributeDefinition`) |
| **Identity Management** | Ephemeral layer IDs (`textShape#1`) | Stable UUID-based resolution (`uuid` ↔ `layerId`) |
| **Batch Execution** | None (sequential round trips) | Fail-fast atomic batch runner with `$ref` variable propagation |
| **Curve Control** | Presets only (`BounceOut`, `Linear`) | Full tangent coordinates, angle/weight locking, and velocity |
| **Visual Previews** | Raw PNG frame export | Scaled frames, contact sheets with frame labels, preview video |
| **Security** | Unrestricted filesystem & script execution | Tiered permissions, path sandboxing, and safe mode defaults |

---

## 3. The Three-Level Control Model

To provide low-friction autonomy while maintaining strict stability and safety:

### Level 1 — Structured MCP (Default & Primary)
* Fully validated with Zod schemas.
* No string interpolation or code evaluation.
* The MCP server serializes parameters into structured JSON command payloads (`{ op: "layer_create", params: { ... } }`).
* The Cavalry bridge dispatches payloads to dedicated handler functions.

### Level 2 — Raw Cavalry Scripting (Escape Hatch)
* Exposed via `cavalry_raw_script`.
* **Disabled by default**.
* Requires explicit environment variable: `CAVALRY_ALLOW_RAW_SCRIPT=true`.
* Intended exclusively for edge-case Cavalry APIs not yet mapped to structured tools.

### Level 3 — UI Automation Fallback (Not Yet Implemented)
* Reserved for actions impossible via Cavalry's scripting API (such as Command Search, Workspaces, Tags, Presets, or interactive modal dialogs).
* The current build deliberately reports these operations as `UNSUPPORTED`; it does not claim an accessibility or vision fallback that has not been verified.
* `coverage/cavalry-capabilities.json` and `cavalry_parity_audit` are the source of truth for these remaining gaps.

---

## 4. Introspection-Driven System Design

Cavalry provides deep runtime reflection. The MCP server queries the live instance at startup or on demand:
1. **Capabilities Discovery (`cavalry_capabilities`)**: Checks bridge version, Cavalry version, Pro license status, supported layer types, generator types, and tangent features.
2. **Dynamic Layer Creation**: When requested to create a layer (e.g. `particleEmitter` or a 3rd-party plugin node), the server validates the type against the live registry returned by `api.getAllLayerTypes()`.
3. **Attribute Reflection (`attribute_describe`)**: Inspects types (`double`, `color`, `enum`), default values, animatable status, read-only status, bounds (`min`/`max`), and enum values before attempting mutation.
4. **Graph Validation (`graph_validate_connection`)**: Validates type compatibility before wiring nodes together in the procedural graph.

---

## 5. Stable Layer Identities (UUID Resolver)

Cavalry's internal names (`basicShape#1`, `textShape#2`) are volatile. Every layer returned to the agent includes its stable UUID:
```json
{
  "layerId": "textShape#2",
  "uuid": "4c0b4352-89f5-4702-8618-fa0ce70498a5",
  "type": "textShape",
  "name": "Title"
}
```
All tools accept either `layerId` or `uuid` through a transparent resolver:
1. If the input matches a UUID format, `api.getLayerFromUUID(uuid)` resolves it to the active `layerId`.
2. Results are cached in memory for sub-millisecond lookups and cleared whenever scenes are loaded or layers are deleted.

---

## 6. Bridge Protocol & Communication Architecture

Communication between the Node.js MCP server and Cavalry uses local loopback HTTP (`127.0.0.1`):
* **Cavalry Bridge Script**: Runs inside Cavalry as a UI script (`cavalry/bridge.js`). It instantiates `api.WebServer()`, listens on `127.0.0.1:8080`, and sets realtime polling (`server.setRealtime()`, 60 Hz).
* **Correlation ID**: Every request includes a unique UUID (`req-xxxx`).
* **Tri-Modal Response Delivery**:
  1. **Direct WebClient Callback**: In the bridge `onPost` handler, after executing the command, the bridge attempts to POST the response directly to the MCP server's internal callback receiver.
  2. **`WebServer.setResultForGet`**: The bridge stores the result on the WebServer so the client can retrieve it via `GET /get`.
  3. **File IPC Fallback**: In restricted network configurations, the request can specify a response file path written via `api.writeToFile()`.

---

## 7. Batching with Symbolic References

AI agents frequently need to chain operations (e.g., create layer -> configure position -> connect to duplicator). To eliminate round-trip latency:
* The `cavalry_batch` tool accepts a sequence of operations.
* Operations can declare `saveAs: "$variableName"`.
* Subsequent operations in the same batch can reference `$variableName` or `$variableName.property` in their parameter maps.
* The batch engine performs topological substitution in memory on the bridge side and executes atomically in fail-fast mode.

---

## 8. Security & Filesystem Sandboxing

### Permission Tiers
1. **SAFE Mode (Default)**: Structured scene and animation tools only. Filesystem operations restricted to approved directories. Raw script execution blocked.
2. **EXTENDED Mode**: Permits project file saves, asset imports, and render outputs within designated project and temp paths.
3. **RAW Mode**: Explicitly enabled with `CAVALRY_ALLOW_RAW_SCRIPT=true`.

### Filesystem Sandbox
* All path inputs are canonicalized using `path.resolve()` and `fs.realpathSync()`.
* Paths outside the designated workspace root, configured asset directories, or system temporary directory are rejected with `FILE_NOT_ALLOWED`.
* Directory traversal (`../`) and unauthorized symlink attacks are blocked.

---

## 9. Visual Feedback Pipeline

For autonomous motion design, the agent must be able to inspect its work visually:
1. **Frame Preview (`preview_frame`)**: Renders individual frames at custom resolutions (e.g. 50% scale for fast evaluation) via `api.renderPNGFrame()`.
2. **Contact Sheets (`preview_contact_sheet`)**: Renders a uniform sequence of frames (e.g. frames 0, 15, 30, 45, 60), compositing them into a single tiled image with burned-in frame numbers.
3. **Video Previews (`preview_video`)**: Renders an image sequence and packages it into an MP4/WebM clip for timeline review.
