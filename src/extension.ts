import * as vscode from 'vscode';
import { locate } from './codexLocator';
import { readLimits } from './appServerClient';
import { normalize } from './usage';
import { configuration } from './configuration';
import { Monitor } from './monitor';
import { describe, render, tr } from './statusBar';

export function activate(context: vscode.ExtensionContext) {
    const item = vscode.window.createStatusBarItem('codexUsage', vscode.StatusBarAlignment.Right, 0);
    item.name = 'Codex Usage Monitor';
    item.command = 'codexUsageMonitor.refresh';
    const log = vscode.window.createOutputChannel('Codex Usage Monitor', { log: true });
    let cfg = configuration();
    let monitor: Monitor | undefined;
    let attempted = 0;
    function configure() {
        const previous = cfg;
        cfg = configuration();
        if (!cfg.enabled || cfg.path !== previous.path) {
            monitor?.dispose();
            monitor = undefined;
            item.hide();
        }
        if (!cfg.enabled) return;
        if (!monitor) {
            monitor = new Monitor(async signal => {
                attempted = Date.now();
                const cmd = await locate(cfg.path, vscode.extensions.getExtension('openai.chatgpt')?.extensionPath);
                return normalize(await readLimits(cmd, signal));
            }, () => {
                if (!monitor) return;
                if (monitor.failure) log.warn(describe(monitor.failure));
                else log.info(tr('Usage refreshed.', '利用状況を更新しました。'));
                render(item, monitor, cfg);
            }, () => vscode.window.state.focused);
            void monitor.refresh();
        }
        render(item, monitor, cfg);
        monitor.schedule(cfg.interval);
    }
    const command = vscode.commands.registerCommand;
    context.subscriptions.push(item, log, { dispose: () => monitor?.dispose() },
        command(item.command, () => monitor?.refresh()),
        command('codexUsageMonitor.openDashboard', () => vscode.env.openExternal(vscode.Uri.parse('https://chatgpt.com/settings/usage'))),
        command('codexUsageMonitor.showDiagnostics', () => log.show(true)),
        vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('codexUsageMonitor')) configure(); }),
        vscode.window.onDidChangeWindowState(s => {
            if (s.focused && Date.now() - attempted >= cfg.interval * 1000) void monitor?.refresh();
        }));
    configure();
}
