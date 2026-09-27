# Cavalry Bridge Installation Guide

This guide explains how to install and activate the **Cavalry MCP Bridge** inside Cavalry.

---

## 1. Locate Cavalry's User Scripts Directory

On macOS, user scripts reside at:
```text
~/Library/Application Support/Cavalry/Scripts
```

*(Note: The `~/Library` folder is hidden by default. In Finder, hold the **Option (⌥)** key and select **Go > Library**, then navigate to `Application Support > Cavalry > Scripts`).*

Alternatively, inside Cavalry, click **Help > Show Scripts Folder**.

On Windows:
```text
%USERPROFILE%\AppData\Roaming\Cavalry\Scripts
```

---

## 2. Copy the Bridge Script

Copy `cavalry/bridge.js` into Cavalry's Scripts folder:

```bash
# Automated copy command on macOS
mkdir -p ~/Library/Application\ Support/Cavalry/Scripts
cp cavalry/bridge.js ~/Library/Application\ Support/Cavalry/Scripts/CavalryBridge.js
```

---

## 3. Activate the Bridge in Cavalry

1. Open **Cavalry**.
2. From the top menu bar, select **Scripts > CavalryBridge**.
3. A small status window titled **Cavalry MCP Bridge** will open showing:
   ```text
   ● Listening on 127.0.0.1:8080
   Requests: 0
   Bridge v1.0.0 | Autonomous Operator
   ```
4. Keep this window open while running AI workflows via Claude Code.

For supervised macOS workflows, set `CAVALRY_WATCHDOG_AUTO_RESTART=true`. The MCP watchdog relaunches Cavalry, activates `Scripts > CavalryBridge`, waits for authenticated bridge health, and restores its checkpoint after a host failure.

On macOS, `npm run bridge:launch` installs the current packaged bridge, opens Cavalry, and activates it. This requires Accessibility permission for the terminal or Codex host that invokes the launcher.

---

## 4. Troubleshooting

* **Address in use error**: If port 8080 is already occupied (e.g. by another bridge or dev server), you can configure a different port in `bridge.js` and set `CAVALRY_BRIDGE_PORT` in your `.env` file.
* **Bridge not appearing under Scripts menu**: Restart Cavalry or click **Scripts > Reload Scripts**.
