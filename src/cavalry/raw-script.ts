import { bridgeClient } from '../bridge/client.js';
import { permissions } from '../mcp/permissions.js';

export async function executeRawScript(code: string): Promise<unknown> {
  permissions.assertRawScript('cavalry_raw_script');
  const res = await bridgeClient.send<any>('cavalry_raw_script', { code });
  return res.result?.result;
}
