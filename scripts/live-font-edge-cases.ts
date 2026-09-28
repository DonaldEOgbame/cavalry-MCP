import assert from 'node:assert/strict';
import { bridgeClient } from '../src/bridge/client.js';
import { checkFontExists, listInstalledFonts } from '../src/design/typography.js';

const families = await listInstalledFonts();
assert.ok(families.length > 0);
const missingFamily = await checkFontExists(`MCP Missing ${Date.now()}`, 'Regular') as any;
assert.equal(missingFamily.available, false);
assert.equal(missingFamily.familyAvailable, false);
assert.equal(missingFamily.restartRequired, true);

const family = families[0];
const missingWeight = await checkFontExists(family, `MCP Missing Weight ${Date.now()}`) as any;
assert.equal(missingWeight.available, false);
assert.equal(missingWeight.familyAvailable, true);
assert.equal(missingWeight.reason, 'weight_style_or_postscript_name_unavailable');

const variableProbe = await checkFontExists(family, 'Variable') as any;
assert.equal(variableProbe.variableFontRequested, true);
assert.equal(typeof variableProbe.duplicateFamilyEntries, 'number');
assert.match(String(variableProbe.message), /Cavalry|font|style/i);

process.stdout.write(`${JSON.stringify({ families: families.length, familyProbe: family, missingFamily, missingWeight, variableProbe }, null, 2)}\n`);
await bridgeClient.stopCallbackServer();
