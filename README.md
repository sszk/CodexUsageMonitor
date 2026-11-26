# Codex Usage Monitor

[日本語](README.ja.md)

See your remaining short- and long-window Codex quota in the right side of the VS Code status bar. This independent extension uses the theme's dashboard icon. A typical reading is **82% / 64%**. Hover for the window lengths, local reset times, last successful update and credit balance when available. Click to refresh.

## Install

1. Use desktop VS Code 1.90 or later on macOS, Windows or Linux. Install a [Codex CLI](https://developers.openai.com/codex/cli/) with App Server support and sign in with a ChatGPT account that provides usage limits.
2. Download or build the VSIX. In VS Code, run **Extensions: Install from VSIX…** and select `codex-usage-monitor-<version>.vsix`. For Remote SSH, WSL and Dev Containers, install the extension locally.
3. The first read starts on activation. Subsequent automatic reads run in the focused window. Returning to a window refreshes it if its last attempt is older than the interval.

## Settings

Search Settings for `codexUsageMonitor`. Changes take effect immediately.

| Setting (prefix `codexUsageMonitor.`) | Default | Meaning |
|---|---:|---|
| `enabled` | true | Show the item and refresh usage |
| `refreshInterval` | 300 | Seconds between automatic reads (minimum 60) |
| `codexPath` | empty | Absolute executable path in local User settings |
| `warningEnabled` | true | Use theme warning and error backgrounds |
| `warningThreshold` | 20 | Warn when either remaining percentage is at or below this value |
| `criticalThreshold` | 5 | Show an error at or below this value |

Thresholds range from 0 to 100. The effective critical threshold is capped at the warning threshold.

## Troubleshooting

- **CLI missing** — set `codexPath` if VS Code's PATH differs from your terminal's. An explicit path takes priority. Automatic discovery checks PATH, common local install locations, then a compatible binary bundled with the official extension. On Windows, select `codex.exe` or a supported global npm `codex.cmd` shim.
- **Unknown quota** — `--%` marks an unavailable window. API-key accounts may have no ChatGPT plan limits. Check the tooltip and the account used by the local CLI.
- **Old reading** — a clock/history icon replaces the dashboard icon after a failed update. Hover for the failure reason and timestamp. Click to retry, or run **Codex Usage Monitor: Show Diagnostics**. Reads time out after 20 seconds.
- **Compare with the website** — run **Codex Usage Monitor: Open Usage Dashboard**. The status bar click and **Codex Usage Monitor: Refresh** only refresh the reading.

## Protocol and privacy

Each read starts a local App Server, completes its initialization handshake, requests `account/rateLimits/read`, then closes the process. The CLI manages its own authentication. The extension never reads credential files, handles tokens, creates sessions, sends prompts, or spends credits. Usage stays in memory. Diagnostics record status messages only. No telemetry or runtime npm dependencies.

The keyed `codex` bucket takes precedence over the compatible single-bucket response. Percentages are calculated from reported usage; reset timestamps are Unix seconds. The dashboard icon uses VS Code theme colors. [App Server reference](https://learn.chatgpt.com/docs/app-server) · [Protocol source](https://github.com/openai/codex/tree/main/codex-rs/app-server-protocol/schema/typescript/v2) · [OpenAI brand guidelines](https://openai.com/brand/)

## Development

With Node.js 22.14+ and npm, run `npm ci`, `npm run check`, `npm test`, then `npm run package`. Tests use a local mock App Server. Press F5 in VS Code to build and launch an Extension Development Host.
