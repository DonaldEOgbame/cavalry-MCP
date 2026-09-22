import { execFile } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { bridgeClient } from '../bridge/client.js';

const execFileAsync = promisify(execFile);
const MENUS = ['File', 'View', 'Composition', 'Create', 'Animation', 'Shape', 'Tool', 'Dynamics', 'Window', 'Scripts', 'Help'];
const TOOLS = ['Select', 'Edit Shape', 'Camera', 'Arc', 'Arrow', 'Capsule', 'Cogwheel', 'Ellipse', 'Line', 'Mesh', 'Pen', 'Pencil', 'Pivot', 'Polygon', 'Rectangle', 'Star', 'Super Ellipse', 'Super Shape', 'Text', 'Tracking'];

function assertAvailable(): void {
  if (process.platform !== 'darwin') throw new Error('PLATFORM_LIMITATION: Cavalry UI Driver currently supports macOS only.');
  if (process.env.CAVALRY_UI_DRIVER !== 'true') throw new Error('UI_DRIVER_DISABLED: Set CAVALRY_UI_DRIVER=true to opt into interactive macOS Accessibility control.');
}

async function appleScript(script: string, args: string[] = []): Promise<string> {
  assertAvailable();
  const { stdout } = await execFileAsync('/usr/bin/osascript', ['-e', script, ...args], { maxBuffer: 4 * 1024 * 1024 });
  return stdout.trim();
}

const RAISE_PROJECT = `
on raiseProjectWindow()
  tell application "System Events"
    tell process "Cavalry"
      set frontmost to true
      repeat with w in windows
        try
          if (name of w as text) starts with "Project:" then
            perform action "AXRaise" of w
            exit repeat
          end if
        end try
      end repeat
    end tell
  end tell
end raiseProjectWindow
`;

export async function uiDriverStatus(): Promise<Record<string, unknown>> {
  if (process.platform !== 'darwin') return { available: false, status: 'PLATFORM_LIMITATION', platform: process.platform };
  if (process.env.CAVALRY_UI_DRIVER !== 'true') return { available: false, status: 'DISABLED', enableWith: 'CAVALRY_UI_DRIVER=true' };
  try {
    const enabled = await appleScript('tell application "System Events" to get UI elements enabled');
    return { available: enabled === 'true', accessibilityEnabled: enabled === 'true', platform: 'darwin', interactive: true };
  } catch (error) {
    return { available: false, status: 'PLATFORM_LIMITATION', error: error instanceof Error ? error.message : String(error) };
  }
}

async function menuItems(menuName: string): Promise<Array<{ menu: string; command: string; shortcut?: string }>> {
  const output = await appleScript(`${RAISE_PROJECT}
on run argv
  my raiseProjectWindow()
  set menuName to item 1 of argv
  tell application "System Events" to tell process "Cavalry"
    set output to ""
    repeat with mi in menu items of menu 1 of menu bar item menuName of menu bar 1
      try
        set commandName to name of mi as text
        if commandName is not "missing value" then
          set shortcutValue to ""
          try
            set shortcutValue to value of attribute "AXMenuItemCmdChar" of mi as text
          end try
          set output to output & commandName & tab & shortcutValue & linefeed
        end if
      end try
    end repeat
    return output
  end tell
end run`, [menuName]);
  return output.split('\n').filter(Boolean).map(line => {
    const [command, shortcut] = line.split('\t');
    return { menu: menuName, command, ...(shortcut ? { shortcut } : {}) };
  });
}

export async function commandSearch(query: string): Promise<Record<string, unknown>> {
  const commands: Array<{ menu: string; command: string; shortcut?: string }> = [];
  for (const menu of MENUS) {
    try { commands.push(...await menuItems(menu)); } catch {}
  }
  const needle = query.toLocaleLowerCase();
  const matches = commands.filter(item => item.command.toLocaleLowerCase().includes(needle));
  return { query, count: matches.length, matches };
}

export async function commandExecute(command: string, menu?: string): Promise<Record<string, unknown>> {
  let resolvedMenu = menu;
  if (!resolvedMenu) {
    const found = await commandSearch(command);
    const exact = (found.matches as any[]).filter(item => item.command === command);
    if (exact.length !== 1) throw new Error(`Command must resolve uniquely; found ${exact.length} exact matches.`);
    resolvedMenu = exact[0].menu;
  }
  if (!resolvedMenu) throw new Error('Unable to resolve the Cavalry menu for this command.');
  await appleScript(`${RAISE_PROJECT}
on run argv
  my raiseProjectWindow()
  tell application "System Events" to tell process "Cavalry"
    click menu item (item 2 of argv) of menu 1 of menu bar item (item 1 of argv) of menu bar 1
  end tell
end run`, [resolvedMenu, command]);
  return { executed: true, menu: resolvedMenu, command, interactive: true };
}

export async function shortcutDiscover(query?: string): Promise<Record<string, unknown>> {
  const search = await commandSearch(query ?? '');
  const shortcuts = (search.matches as any[]).filter(item => item.shortcut);
  const overridesPath = join(homedir(), 'Library/Preferences/Cavalry/shortcuts.json');
  const overrides = await readFile(overridesPath, 'utf8').then(JSON.parse).catch(() => ({ shortcuts: {} }));
  return { query: query ?? '', count: shortcuts.length, shortcuts, userOverrides: overrides.shortcuts ?? {} };
}

export async function shortcutExecute(key: string, modifiers: string[]): Promise<Record<string, unknown>> {
  const allowed = new Set(['command', 'option', 'control', 'shift']);
  if (!modifiers.every(modifier => allowed.has(modifier))) throw new Error('Unsupported shortcut modifier.');
  const modifierScript = modifiers.length ? ` using {${modifiers.map(value => `${value} down`).join(', ')}}` : '';
  const specialKeyCodes: Record<string, number> = { Escape: 53, Return: 36, Tab: 48, Space: 49, Left: 123, Right: 124, Down: 125, Up: 126 };
  const action = specialKeyCodes[key] === undefined
    ? `keystroke (item 1 of argv)${modifierScript}`
    : `key code ${specialKeyCodes[key]}${modifierScript}`;
  await appleScript(`${RAISE_PROJECT}
on run argv
  my raiseProjectWindow()
  tell application "System Events" to ${action}
end run`, [key]);
  return { executed: true, key, modifiers, interactive: true };
}

export async function toolSetActive(tool: string): Promise<Record<string, unknown>> {
  if (!TOOLS.includes(tool)) throw new Error(`Unknown Cavalry tool '${tool}'.`);
  return commandExecute(tool, 'Tool');
}

export async function workspaceList(): Promise<Record<string, unknown>> {
  const output = await appleScript(`${RAISE_PROJECT}
on run
  my raiseProjectWindow()
  tell application "System Events" to tell process "Cavalry"
    set output to ""
    repeat with mi in menu items of menu 1 of menu item "Workspaces" of menu 1 of menu bar item "Window" of menu bar 1
      try
        set n to name of mi as text
        if n is not "missing value" then set output to output & n & linefeed
      end try
    end repeat
    return output
  end tell
end run`);
  const workspaces = output.split('\n').filter(Boolean);
  return { count: workspaces.length, workspaces };
}

export async function workspaceSwitch(name: string): Promise<Record<string, unknown>> {
  await appleScript(`${RAISE_PROJECT}
on run argv
  my raiseProjectWindow()
  tell application "System Events" to tell process "Cavalry"
    click menu item (item 1 of argv) of menu 1 of menu item "Workspaces" of menu 1 of menu bar item "Window" of menu bar 1
  end tell
end run`, [name]);
  return { switched: true, workspace: name, interactive: true };
}

export async function workspaceSave(name: string): Promise<Record<string, unknown>> {
  await commandExecute('Save Workspace...', 'Window');
  await appleScript(`on run argv
  tell application "System Events" to tell process "Cavalry"
    tell window "Save Workspace"
      set value of text field 1 to item 1 of argv
      click button "Save"
    end tell
  end tell
end run`, [name]);
  const listed = await workspaceList();
  if (!(listed.workspaces as string[]).includes(name)) throw new Error(`Workspace '${name}' was not present after Save.`);
  return { saved: true, workspace: name, verified: true, interactive: true };
}
export const workspaceReset = () => commandExecute('Reset to Default Workspace', 'Window');
export const windowOpen = (name: string) => commandExecute(name, 'Window');
export const viewportAdd = () => commandExecute('Add Viewport', 'Window');
export const focusMode = () => commandExecute('Focus Mode', 'Window');

export async function windowClose(title: string): Promise<Record<string, unknown>> {
  await appleScript(`on run argv
  tell application "System Events" to tell process "Cavalry"
    repeat with w in windows
      if (name of w as text) is (item 1 of argv) then
        perform action "AXClose" of w
        return
      end if
    end repeat
    error "Cavalry window not found"
  end tell
end run`, [title]);
  return { closed: true, title, interactive: true };
}

async function choosePathInDialog(path: string): Promise<void> {
  await appleScript(`on run argv
  tell application "System Events" to tell process "Cavalry"
    keystroke "g" using {command down, shift down}
    delay 0.5
    set previousClipboard to the clipboard
    set the clipboard to (item 1 of argv)
    keystroke "v" using {command down}
    set the clipboard to previousClipboard
    key code 36
    delay 1
  end tell
end run`, [path]);
}

async function confirmNativeDialog(buttonName: 'Open' | 'Save'): Promise<void> {
  await appleScript(`on run argv
  tell application "System Events" to tell process "Cavalry"
    click button (item 1 of argv) of window 1
    delay 1
  end tell
end run`, [buttonName]);
}

export async function dialogOpenFile(path: string): Promise<Record<string, unknown>> {
  await appleScript(`${RAISE_PROJECT}
on run
  my raiseProjectWindow()
  tell application "System Events" to tell process "Cavalry"
    keystroke "o" using {command down}
    delay 0.5
  end tell
end run`);
  await choosePathInDialog(path);
  await confirmNativeDialog('Open');
  const health = await bridgeClient.send<any>('cavalry_health', {}, 5_000);
  if (health.result?.activeScenePath !== path) throw new Error(`Native open dialog did not produce the requested scene: ${path}`);
  return { submitted: true, verified: true, path, activeScenePath: health.result.activeScenePath, interactive: true };
}

export async function dialogSaveFile(path: string): Promise<Record<string, unknown>> {
  const previousMtime = await stat(path).then(value => value.mtimeMs).catch(() => 0);
  await appleScript(`${RAISE_PROJECT}
on run
  my raiseProjectWindow()
  tell application "System Events" to tell process "Cavalry"
    keystroke "s" using {command down, shift down}
    delay 0.5
  end tell
end run`);
  await choosePathInDialog(path);
  await confirmNativeDialog('Save');
  const saved = await stat(path).catch(() => undefined);
  if (!saved || saved.mtimeMs <= previousMtime) throw new Error(`Native save dialog did not write the requested scene: ${path}`);
  return { submitted: true, verified: true, path, size: saved.size, interactive: true };
}

export async function dialogChooseFolder(path: string): Promise<Record<string, unknown>> {
  await choosePathInDialog(path);
  return { submitted: true, path, interactive: true, requiresOpenFolderDialog: true };
}

export async function preferencesList(): Promise<Record<string, unknown>> {
  const preferencesPath = join(homedir(), 'Library/Preferences/Cavalry/preferences.json');
  const values = JSON.parse(await readFile(preferencesPath, 'utf8'));
  const keys = Object.keys(values).sort();
  return { preferencesPath, count: keys.length, keys };
}

export async function presetList(): Promise<Record<string, unknown>> {
  const livePath = await bridgeClient.send<any>('preset_path').then(response => response.result?.path).catch(() => undefined);
  const candidates = [
    livePath,
    join(homedir(), 'Library/Application Support/Cavalry/Presets'),
    join(homedir(), 'Library/Application Support/Cavalry/presets'),
  ].filter((value): value is string => Boolean(value));
  for (const path of candidates) {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      return { path, count: entries.length, presets: entries.map(entry => ({ name: entry.name, directory: entry.isDirectory() })) };
    } catch {}
  }
  return { status: 'PLATFORM_LIMITATION', count: 0, presets: [], message: 'The installed Cavalry profile exposes no filesystem preset directory at the standard paths.' };
}

export function unsupportedUiCapability(capability: string, alternative?: string): Record<string, unknown> {
  return {
    status: 'PLATFORM_LIMITATION',
    capability,
    message: `Cavalry 2.7.2 exposes no stable scripting or Accessibility route for ${capability}.`,
    ...(alternative ? { alternative } : {}),
  };
}
