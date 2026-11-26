import * as vscode from 'vscode';
export function configuration() {
    const cfg = vscode.workspace.getConfiguration('codexUsageMonitor');
    const integer = (key: string, fallback: number, min: number, max: number) => {
        const n = cfg.get(key, fallback);
        return Number.isInteger(n) ? Math.max(min, Math.min(n, max)) : fallback;
    };
    const warning = integer('warningThreshold', 20, 0, 100);
    return {
        enabled: cfg.get('enabled', true), warningEnabled: cfg.get('warningEnabled', true),
        warning, critical: integer('criticalThreshold', 5, 0, warning),
        interval: integer('refreshInterval', 300, 60, 2147483),
        path: cfg.inspect<string>('codexPath')?.globalValue ?? ''
    };
}
