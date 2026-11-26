# Codex Usage Monitor

[English](README.md)

VS Code のステータスバー右側に、Codex の短期枠と長期枠の残量を **82% / 64%** の形式で表示します。非公式の拡張機能です。アイコンには VS Code 標準のダッシュボードを使用します。カーソルを合わせると、各枠の期間、現地時間でのリセット日時、最終更新日時、取得できた場合はクレジット残高を確認できます。クリックすると再取得します。

## インストール

1. macOS、Windows または Linux でデスクトップ版 VS Code 1.90 以降を使用します。App Server に対応した [Codex CLI](https://developers.openai.com/codex/cli/) を用意し、利用枠を確認できる ChatGPT アカウントで CLI にログインしてください。
2. VSIX を入手するか、下記の手順でビルドします。VS Code のコマンドパレットで「VSIX からのインストール」を選び、`codex-usage-monitor-<version>.vsix` を指定します。Remote SSH、WSL、Dev Containers の場合はローカル側にインストールしてください。
3. 有効化時に初回取得します。その後はフォーカス中のウィンドウで定期更新します。ウィンドウに戻った際も、前回の取得試行から更新間隔を過ぎていれば再取得します。

## 設定

設定画面で `codexUsageMonitor` を検索してください。変更は即時反映されます。

| 設定名（先頭の `codexUsageMonitor.` を省略） | 初期値 | 内容 |
|---|---:|---|
| `enabled` | true | 残量表示と更新を有効化 |
| `refreshInterval` | 300 | 自動更新の間隔（秒）。最短60秒 |
| `codexPath` | 空文字列 | ローカルのユーザー設定で指定する実行ファイルの絶対パス |
| `warningEnabled` | true | テーマの警告色・エラー色による表示 |
| `warningThreshold` | 20 | いずれかの残量がこの値以下で警告 |
| `criticalThreshold` | 5 | いずれかの残量がこの値以下でエラー |

しきい値の範囲は 0～100 です。エラーしきい値が警告しきい値を超える場合は、警告しきい値を上限として扱います。

## トラブルシューティング

- **CLI が見つからない** — GUI 起動時にターミナルと PATH が異なる場合は `codexPath` を指定してください。指定したパスを優先し、自動検索では PATH、一般的なインストール先、公式拡張に同梱された対応バイナリを順に確認します。Windows では `codex.exe` または対応する npm グローバル版の `codex.cmd` を指定できます。
- **残量が不明** — 取得できない枠は `--%` と表示します。API キー認証などでは ChatGPT の利用枠が返らないことがあります。ツールチップとローカル CLI のログイン状態を確認してください。
- **表示が古い** — 更新失敗時には時計アイコンに切り替わり、直前の成功値を保持します。ツールチップで失敗理由と最終更新日時を確認できます。クリックで再取得でき、コマンド「Codex Usage Monitor: 診断情報を表示」で履歴を確認できます。応答のタイムアウトは20秒です。
- **Web で照合する** — コマンド「Codex Usage Monitor: 利用状況ダッシュボードを開く」を実行します。ステータスバーのクリックと「Codex Usage Monitor: 更新」は再取得のみを行います。

## 通信とプライバシー

取得ごとにローカルの App Server を起動し、初期化後に `account/rateLimits/read` を呼び出して終了します。認証は CLI に委ね、拡張機能が認証ファイルやトークンを直接扱うことはありません。セッション作成、プロンプト送信、クレジット消費の操作は行いません。利用状況はメモリ内に保持し、診断ログには状態メッセージのみを記録します。テレメトリーと実行時の npm 依存はありません。

複数グループの応答では `codex` 枠を優先します。残量は取得した使用率から算出し、リセット時刻は Unix 秒から変換します。[公式 App Server 資料](https://learn.chatgpt.com/docs/app-server)・[プロトコルのソース](https://github.com/openai/codex/tree/main/codex-rs/app-server-protocol/schema/typescript/v2)・[ロゴの使用条件](https://openai.com/brand/)

## 開発

Node.js 22.14 以降と npm を用意し、`npm ci`、`npm run check`、`npm test`、`npm run package` を順に実行します。自動テストにはローカルの模擬 App Server を使用します。VS Code で F5 を押すとビルドして拡張機能のデバッグを開始します。
