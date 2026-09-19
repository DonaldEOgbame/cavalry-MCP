import { bridgeClient } from '../bridge/client.js';
import { metadataCache } from '../utils/cache.js';
import { identityResolver } from '../utils/ids.js';

export interface CavalryEvent {
  event: string;
  timestamp: number;
  layerId?: string;
  uuid?: string;
  assetId?: string;
  attribute?: string;
  [key: string]: unknown;
}

function applyInvalidations(events: CavalryEvent[]): void {
  for (const event of events) {
    if (event.event === 'scene.changed') {
      metadataCache.clear();
      identityResolver.invalidate();
    } else if (event.event === 'layer.removed' && event.layerId) {
      identityResolver.invalidate(event.layerId);
      metadataCache.invalidatePrefix('scene:');
      metadataCache.invalidatePrefix('layer:');
    } else if (event.event === 'layer.added') {
      metadataCache.invalidatePrefix('scene:');
      metadataCache.invalidatePrefix('layer:');
    } else if (event.event.startsWith('attribute.')) {
      metadataCache.invalidatePrefix('attribute:');
      metadataCache.invalidatePrefix('graph:');
    } else if (event.event.startsWith('asset.')) {
      metadataCache.invalidatePrefix('asset:');
    } else if (event.event === 'preference.changed') {
      metadataCache.invalidatePrefix('preference:');
    }
  }
}

export async function eventsSubscribe(events?: string[]) {
  const response = await bridgeClient.send('events_subscribe', { events });
  return response.result;
}

export async function eventsUnsubscribe(events?: string[]) {
  const response = await bridgeClient.send('events_unsubscribe', { events });
  return response.result;
}

export async function eventsPoll(limit?: number) {
  const response = await bridgeClient.send<{ events: CavalryEvent[]; count: number; remaining: number }>('events_poll', { limit });
  applyInvalidations(response.result?.events ?? []);
  return response.result;
}

export async function eventsGetRecent(limit?: number) {
  const response = await bridgeClient.send<{ events: CavalryEvent[]; count: number }>('events_get_recent', { limit });
  return response.result;
}

export async function eventsClear() {
  return (await bridgeClient.send('events_clear')).result;
}

export async function eventsStatus() {
  return (await bridgeClient.send('events_status')).result;
}

export async function appState() { return (await bridgeClient.send('app_state')).result; }
export async function appIsActive() { return (await bridgeClient.send('app_is_active')).result; }
export async function appActiveTool() { return (await bridgeClient.send('app_active_tool')).result; }
export async function appPlatform() { return (await bridgeClient.send('app_platform')).result; }
export async function appVersion() { return (await bridgeClient.send('app_version')).result; }
export async function appLicense() { return (await bridgeClient.send('app_license')).result; }
export async function bridgeFlushEvents() { return (await bridgeClient.send('bridge_flush_events')).result; }
