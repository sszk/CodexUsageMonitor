import * as vscode from 'vscode';
import { Monitor } from './monitor';
import { Problem, severity } from './usage';
import { configuration } from './configuration';

const ja = vscode.env.language.startsWith('ja');
export const tr = (en: string, jp: string) => ja ? jp : en;
const messages: Record<Problem, string> = {
    missing: tr('Install the Codex CLI or set codexUsageMonitor.codexPath to its absolute path.', 'Codex CLI をインストールするか、codexUsageMonitor.codexPath に絶対パスを指定してください。'),
    auth: tr('ChatGPT sign-in is required. Check the account used by your local Codex CLI.', 'ChatGPT へのログインが必要です。ローカルの Codex CLI のアカウントを確認してください。'),
    rpc: tr('The App Server could not read usage. Check connectivity and CLI sign-in.', '利用状況を取得できません。接続と CLI のログイン状態を確認してください。'),
    invalid: tr('Unexpected App Server response. Check the CLI version.', 'App Server の応答形式を認識できません。CLI のバージョンを確認してください。'),
    closed: tr('The App Server connection closed early.', 'App Server への接続が途中で終了しました。'),
    timeout: tr('The App Server timed out.', 'App Server の応答がタイムアウトしました。'),
    cancelled: tr('Refresh cancelled.', '更新を中止しました。'),
    unavailable: tr('No Codex quota was reported for this account.', 'このアカウントの Codex 利用枠は取得できませんでした。')
};
export function describe(p: Problem) { return messages[p]; }
const locale = vscode.env.language;
function duration(minutes?: number) {
    if (!minutes) return '—';
    const unit = minutes % 1440 === 0 ? 'day' : minutes % 60 === 0 ? 'hour' : 'minute';
    const value = minutes / ({ day: 1440, hour: 60, minute: 1 }[unit]);
    return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(value);
}
export function render(item: vscode.StatusBarItem, m: Monitor, cfg: ReturnType<typeof configuration>) {
    const values = [0, 1].map(i => (m.usage?.windows[i]?.remaining ?? '--') + '%');
    const stale = Boolean(m.failure && m.usage);
    item.text = (stale ? '$(history)' : '$(codex-usage-logo)') + ' ' + values.join(' / ');
    const level = severity(m.usage, cfg.warningEnabled, cfg.warning, cfg.critical);
    item.backgroundColor = level ? new vscode.ThemeColor('statusBarItem.' + level + 'Background') : undefined;
    const state = stale ? tr('Stale data', '前回取得した値') : '';
    const reason = m.failure ? describe(m.failure) : '';
    const loading = !m.usage && !m.failure ? tr('Reading usage…', '取得中…') : '';
    item.accessibilityInformation = { label: [
        tr('Codex usage remaining', 'Codex 利用枠残量'), tr('Short window', '短期枠') + ' ' + values[0],
        tr('Long window', '長期枠') + ' ' + values[1], state, loading, reason
    ].filter(Boolean).join(', '), role: 'button' };
    const tip = new vscode.MarkdownString('**' + tr('Codex Usage', 'Codex 利用状況') + '**\n\n');
    if (state) tip.appendMarkdown('**' + state + '**\n\n');
    if (reason || loading) tip.appendText(reason || loading);
    if (m.usage) {
        tip.appendMarkdown('\n\n| ' + tr('Usage window | Remaining | Resets at', '利用枠 | 残量 | リセット日時') + ' |\n|---|---:|---|\n');
        m.usage.windows.forEach((w, i) => {
            const reset = w?.reset === undefined ? '—' : new Date(w.reset).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
            tip.appendMarkdown('| ' + duration(w?.minutes) + ' | ' + values[i] + ' | ' + reset + ' |\n');
        });
        if (m.usage.balance !== undefined) tip.appendMarkdown('\n' + tr('Credit balance', 'クレジット残高') + '　' + m.usage.balance + '\n');
    }
    if (m.updated) tip.appendMarkdown('\n' + tr('Last updated', '最終更新') + '　' + m.updated.toLocaleString(locale) + '\n');
    tip.appendMarkdown('\n' + tr('Click to refresh.', 'クリックして更新。'));
    item.tooltip = tip;
    item.show();
}
