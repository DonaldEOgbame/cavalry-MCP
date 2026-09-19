import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bridgeClient } from '../bridge/client.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

type CoverageStatus = 'STRUCTURED' | 'GENERIC_ATTRIBUTE' | 'RAW_SCRIPT' | 'UI_ACCESSIBILITY' | 'UI_VISION' | 'UNSUPPORTED' | 'UNKNOWN';
interface CapabilityEntry { coverage: CoverageStatus; tools?: string[]; notes?: string }
interface CapabilitiesFile { supportedCavalryVersion: string; capabilities: Record<string, CapabilityEntry> }
interface ApiMethod { method: string; status: string; route?: string; rationale: string }
interface ApiManifest { discovered: number; unexplained: number; methods: ApiMethod[] }

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
}

export async function cavalryParityAudit() {
  const [capabilityText, manualText, apiText, renderFormatText] = await Promise.all([
    readFile(resolve(projectRoot, 'coverage/cavalry-capabilities.json'), 'utf8'),
    readFile(resolve(projectRoot, 'coverage/manual-editor-features.json'), 'utf8'),
    readFile(resolve(projectRoot, 'coverage/cavalry-api-manifest.json'), 'utf8'),
    readFile(resolve(projectRoot, 'coverage/render-formats.json'), 'utf8'),
  ]);
  const capabilities = JSON.parse(capabilityText) as CapabilitiesFile;
  const manual = JSON.parse(manualText) as { features: Record<string, { coverage: string; notes?: string }> };
  const api = JSON.parse(apiText) as ApiManifest;
  const renderFormats = JSON.parse(renderFormatText) as { formats: Record<string, unknown>; codecControls: Record<string, unknown> };
  const entries = Object.entries(capabilities.capabilities);
  const total = entries.length;
  const isStructured = (status: CoverageStatus) => status === 'STRUCTURED' || status === 'GENERIC_ATTRIBUTE';
  const isRawReachable = (status: CoverageStatus) => isStructured(status) || status === 'RAW_SCRIPT';
  const isUiReachable = (status: CoverageStatus) => isRawReachable(status) || status === 'UI_ACCESSIBILITY' || status === 'UI_VISION';
  const counts = entries.reduce<Record<string, number>>((result, [, entry]) => {
    result[entry.coverage] = (result[entry.coverage] || 0) + 1;
    return result;
  }, {});
  const unknown = entries.filter(([, entry]) => entry.coverage === 'UNKNOWN').map(([name]) => name);
  const unsupported = entries.filter(([, entry]) => entry.coverage === 'UNSUPPORTED').map(([name, entry]) => ({ capability: name, reason: entry.notes }));
  let liveVersion: unknown = null;
  if (await bridgeClient.ping()) {
    try { liveVersion = (await bridgeClient.send<{ version: string }>('app_version', {}, 3000)).result?.version; } catch { /* Audit remains usable if the live version read fails. */ }
  }

  return {
    cavalryVersion: liveVersion ?? capabilities.supportedCavalryVersion,
    completionLevel: unsupported.length === 0 && unknown.length === 0 ? 'Full Parity Complete' : 'Not Full Parity Complete',
    claimsMaximumPracticalParity: unsupported.length === 0 && unknown.length === 0,
    capabilityCoverage: {
      total,
      counts,
      structuredPercent: percentage(entries.filter(([, entry]) => isStructured(entry.coverage)).length, total),
      rawScriptReachablePercent: percentage(entries.filter(([, entry]) => isRawReachable(entry.coverage)).length, total),
      uiFallbackReachablePercent: percentage(entries.filter(([, entry]) => isUiReachable(entry.coverage)).length, total),
      unknown,
      knownUncovered: unsupported,
    },
    officialApiCoverage: {
      discovered: api.discovered,
      directBridge: api.methods.filter((method) => method.route === 'bridge').length,
      guardedRawScript: api.methods.filter((method) => method.route === 'guarded_raw_script').length,
      unexplained: api.unexplained,
    },
    manualFeatureMatrix: manual.features,
    renderFormatMatrix: renderFormats,
  };
}
