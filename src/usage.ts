export type Problem = 'missing' | 'auth' | 'rpc' | 'invalid' | 'closed' | 'timeout' | 'cancelled' | 'unavailable';
export class UsageError extends Error {
    constructor(readonly problem: Problem) { super(problem); }
}
export function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export interface WindowUsage {
    remaining?: number;
    minutes?: number;
    reset?: number;
}
export interface Usage {
    windows: [WindowUsage | undefined, WindowUsage | undefined];
    balance?: string;
}
function finite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}
function windowUsage(raw: unknown): WindowUsage | undefined {
    if (raw == null) return undefined;
    if (!record(raw)) throw new UsageError('invalid');
    if (raw.usedPercent != null && !finite(raw.usedPercent)) throw new UsageError('invalid');
    const reset = finite(raw.resetsAt) ? raw.resetsAt * 1000 : NaN;
    return {
        remaining: finite(raw.usedPercent) ? Math.floor(Math.max(0, Math.min(100, 100 - raw.usedPercent))) : undefined,
        minutes: finite(raw.windowDurationMins) && raw.windowDurationMins > 0 ? raw.windowDurationMins : undefined,
        reset: Number.isFinite(new Date(reset).getTime()) ? reset : undefined
    };
}
export function normalize(raw: unknown): Usage {
    if (!record(raw)) throw new UsageError('invalid');
    const groups = raw.rateLimitsByLimitId;
    if (groups != null && !record(groups)) throw new UsageError('invalid');
    const group = groups?.codex ?? raw.rateLimits;
    if (!record(group)) throw new UsageError(groups ? 'unavailable' : 'invalid');
    if (group.limitId != null && group.limitId !== 'codex') throw new UsageError('unavailable');
    if (groups && !groups.codex && group.limitId !== 'codex') throw new UsageError('unavailable');
    let short = windowUsage(group.primary);
    let long = windowUsage(group.secondary);
    if (short?.minutes !== undefined && long?.minutes !== undefined && short.minutes > long.minutes)
        [short, long] = [long, short];
    const balance = record(group.credits) && typeof group.credits.balance === 'string' &&
        /^\d+(?:\.\d+)?$/.test(group.credits.balance) ? group.credits.balance : undefined;
    if (short?.remaining === undefined && long?.remaining === undefined && balance === undefined)
        throw new UsageError('unavailable');
    return { windows: [short, long], balance };
}
export function severity(usage: Usage | undefined, enabled: boolean, warning: number, critical: number) {
    const least = Math.min(...(usage?.windows ?? []).map(w => w?.remaining ?? Infinity));
    if (!enabled || least > warning) return undefined;
    return least <= Math.min(critical, warning) ? 'error' : 'warning';
}
