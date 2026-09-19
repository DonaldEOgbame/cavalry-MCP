# Security & Sandboxing Specification

The **Cavalry Model Context Protocol (MCP)** server provides autonomous AI control over the motion-design application Cavalry. Because an autonomous agent possesses significant authority over assets, scripts, and local processes, strict security tiers and filesystem sandboxing are enforced by default.

---

## 1. Security Tiers

The MCP server implements four explicit permission tiers:

### 1. SAFE Mode (Default)
* Structured scene, composition, layer, attribute, animation, and graph operations ONLY.
* Raw JavaScript evaluation (`cavalry_raw_script`) is completely **disabled**.
* Operating system command execution (`api.runProcess`, `exec`) is **blocked**.
* Filesystem read/write operations are confined to the verified project directory and system temporary directories.

### 2. EXTENDED Mode
* Permits project file saving and opening in designated project and output directories.
* Allows importing external assets from configured asset roots.
* Raw scripting remains disabled unless explicitly overridden.

### 3. RAW Mode (Developer / Escape Hatch)
* Requires an explicit environment variable:
  ```env
  CAVALRY_ALLOW_RAW_SCRIPT=true
  ```
* Enables the `cavalry_raw_script` MCP tool to execute arbitrary JavaScript within Cavalry's `api.*`, `cavalry.*`, and `ui.*` contexts.
* Intended exclusively for automating edge-case Cavalry APIs not yet mapped to structured Level 1 tools.

### 4. SYSTEM_EXEC Mode
* Explicitly guarded by `CAVALRY_ALLOW_SYSTEM_EXEC=true`.
* Never enabled by default.
* Direct shell process spawning from within Cavalry is blocked to protect the host environment.

---

## 2. Filesystem Sandbox

All file paths passed into MCP tools (including `scene_open`, `scene_save_as`, `asset_import`, `preview_frame`, and `component_export`) must pass through the `FilesystemSandbox` validator.

### Sandbox Rules:
1. **Path Canonicalization**: Relative paths are resolved against the current working directory, and symlinks are resolved via `fs.realpathSync()`.
2. **Authorized Roots**: Operations are restricted to:
   * Current working directory (project root)
   * Operating system temporary folder (`/tmp` or OS temp)
   * Dedicated preview output folder (`CAVALRY_PREVIEW_DIR`)
   * Explicitly configured paths in `CAVALRY_ALLOWED_ROOTS` (comma-separated list in `.env`)
3. **Traversal Prevention**: Any path containing `../` that attempts to escape authorized roots is immediately rejected with:
   ```json
   {
     "code": "FILE_NOT_ALLOWED",
     "message": "Access to filesystem path '...' is outside the authorized sandbox roots."
   }
   ```

---

## 3. Network Transport & Loopback Binding

* **Localhost Loopback Only**: The Cavalry bridge listener binds strictly to `127.0.0.1` (port 8080).
* **No Public Exposure**: The bridge server must never be exposed to public network interfaces.
* **Correlated Payloads**: Every request uses an ephemeral UUID request ID and timeout cleanup to prevent replay or dangling requests.
