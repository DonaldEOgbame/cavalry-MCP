/**
 * Deterministic fault injection for reliability testing. Faults are set by the
 * process that launches the MCP server (CAVALRY_FAULT_INJECTION), never by an
 * MCP client, and each one fires a fixed number of times.
 *
 *   CAVALRY_FAULT_INJECTION="render.kill_host_after_start"      # once
 *   CAVALRY_FAULT_INJECTION="render.corrupt_output:2,render.stall"
 */
export const FAULT_NAMES = [
  /** SIGKILL Cavalry a few seconds after the render call is issued (real host loss). */
  'render.kill_host_after_start',
  /** Treat the render as making no progress once the native call returns. */
  'render.stall',
  /** Truncate the finished output to zero bytes before validation. */
  'render.corrupt_output',
  /** Fail render-item configuration readback. */
  'render.fail_configure',
] as const;

export type FaultName = typeof FAULT_NAMES[number];

export class FaultPlan {
  private readonly remainingCounts = new Map<FaultName, number>();
  private readonly fired: Array<{ fault: FaultName; at: string }> = [];

  constructor(spec = process.env.CAVALRY_FAULT_INJECTION ?? '') {
    for (const token of spec.split(',').map((item) => item.trim()).filter(Boolean)) {
      const [name, count] = token.split(':');
      if (!(FAULT_NAMES as readonly string[]).includes(name)) throw new Error(`Unknown fault '${name}' in CAVALRY_FAULT_INJECTION. Known faults: ${FAULT_NAMES.join(', ')}`);
      const parsed = count === undefined ? 1 : Number(count);
      if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`Invalid count for fault '${name}'.`);
      this.remainingCounts.set(name as FaultName, (this.remainingCounts.get(name as FaultName) ?? 0) + parsed);
    }
  }

  /** Consumes one occurrence of a fault; true when it should fire now. */
  take(name: FaultName): boolean {
    const remaining = this.remainingCounts.get(name) ?? 0;
    if (remaining <= 0) return false;
    this.remainingCounts.set(name, remaining - 1);
    this.fired.push({ fault: name, at: new Date().toISOString() });
    return true;
  }

  get active(): boolean {
    return [...this.remainingCounts.values()].some((count) => count > 0) || this.fired.length > 0;
  }

  report(): { remaining: Record<string, number>; fired: Array<{ fault: FaultName; at: string }> } {
    return { remaining: Object.fromEntries(this.remainingCounts), fired: [...this.fired] };
  }
}

export const faults = new FaultPlan();
