#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createMcpServer } from '../src/mcp/server.js';
import { bridgeClient } from '../src/bridge/client.js';

process.env.CAVALRY_UI_DRIVER = 'true';

const root = resolve('coverage/ui-driver');
const reportPath = resolve('coverage/live-ui-driver-results.json');
await mkdir(root, { recursive: true });

const server: any = createMcpServer();
const tools: Record<string, any> = server._registeredTools;
const results: any[] = [];

function parse(response: any): any {
  const text = response?.content?.find((item: any) => item.type === 'text')?.text;
  return text ? JSON.parse(text) : response;
}

async function invoke(tool: string, args: Record<string, unknown> = {}): Promise<any> {
  const started = Date.now();
  const payload = parse(await tools[tool].handler(args, {}));
  assert.equal(payload.ok, true, `${tool}: ${payload.error?.message ?? 'failed'}`);
  const status = payload.result?.status === 'PLATFORM_LIMITATION' ? 'PLATFORM_LIMITATION' : 'PASS';
  results.push({ tool, status, durationMs: Date.now() - started, args, payload });
  return payload.result;
}

function platform(tool: string, reason: string): void {
  results.push({ tool, status: 'PLATFORM_LIMITATION', durationMs: 0, args: {}, limitation: reason });
}

try {
  const status = await invoke('ui_driver_status');
  assert.equal(status.available, true);

  const search = await invoke('command_search', { query: 'Command Search' });
  assert.ok(search.matches.some((item: any) => item.command === 'Command Search'));
  const shortcuts = await invoke('shortcut_discover', { query: 'Command Search' });
  assert.ok(shortcuts.shortcuts.some((item: any) => item.shortcut === '/'));
  await invoke('shortcut_execute', { key: 'Escape', modifiers: [] });

  const preferences = await invoke('preferences_list');
  assert.ok(preferences.count > 100);
  assert.ok(preferences.keys.includes('defaultFrameRate'));

  await invoke('tool_set_active', { tool: 'Select' });
  const activeTool = await invoke('tool_get_active');
  assert.match(String(activeTool.activeTool).toLocaleLowerCase(), /select/);

  const workspaces = await invoke('workspace_list');
  assert.ok(workspaces.count >= 1);
  if (workspaces.workspaces[0] === 'No Workspaces Saved') {
    platform('workspace_switch', 'The clean Cavalry profile has no saved workspace fixture.');
  }

  await invoke('window_open', { name: 'Scene Statistics' });
  await invoke('command_execute', { menu: 'Window', command: 'Scene Statistics' });
  await invoke('focus_mode');
  await invoke('focus_mode');

  await invoke('dialog_open_file', { path: resolve('coverage/safe-fallbacks/safe-fallbacks.cv') });
  await invoke('dialog_save_file', { path: resolve(root, 'not-written-by-ui.cv') });
  await invoke('dialog_choose_folder', { path: root });

  const presetList = await invoke('preset_list');
  assert.ok(Array.isArray(presetList.presets));

  for (const tool of ['preset_apply', 'preset_save', 'preset_delete', 'preset_rename', 'preset_set_default', 'preset_clear_default']) {
    const args = tool === 'preset_apply' ? { name: 'No Fixture' } : { name: 'No Fixture' };
    await invoke(tool, args);
  }
  for (const tool of ['tag_list', 'tag_create', 'tag_delete', 'tag_assign', 'tag_unassign', 'tag_select', 'tag_filter_scene', 'tag_filter_viewport', 'tag_clear_filter']) {
    await invoke(tool, tool === 'tag_clear_filter' || tool === 'tag_list' ? {} : { name: 'Fixture Tag' });
  }
  await invoke('third_party_ui_inspect', { title: 'No third-party custom window fixture installed' });

  // These mutate persistent workspace/window layout or require a pre-existing
  // native folder chooser. They are exposed but deliberately not run in an
  // unattended sweep against the user's editor profile.
  platform('workspace_save', 'Requires explicit approval to create a persistent editor workspace.');
  platform('workspace_reset', 'Requires explicit approval because it resets the user editor layout.');
  platform('window_close', 'No disposable titled top-level Cavalry window is available; dock panels are toggled through command_execute.');
  platform('viewport_add', 'Requires explicit approval because it changes the persistent editor layout.');

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    counts: results.reduce((acc: Record<string, number>, result) => {
      acc[result.status] = (acc[result.status] ?? 0) + 1;
      return acc;
    }, {}),
    results,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ reportPath, counts: report.counts }, null, 2)}\n`);
} finally {
  bridgeClient.stopCallbackServer();
}
