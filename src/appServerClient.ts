import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { record, UsageError, Problem } from './usage';

const { version } = require('../package.json') as { version: string };

export interface Command { file: string; args: string[] }
export function readLimits(command: Command, signal: AbortSignal, timeout = 20000): Promise<unknown> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) return reject(new UsageError('cancelled'));
        const child = spawn(command.file, [...command.args, 'app-server'], {
            cwd: homedir(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'ignore']
        });
        const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
        let pending = 1;
        let done = false;
        const timer = setTimeout(() => finish('timeout'), timeout);
        const abort = () => finish('cancelled');
        function finish(problem?: Problem, result?: unknown) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            signal.removeEventListener('abort', abort);
            lines.close();
            child.stdin.end();
            if (child.pid && child.exitCode === null && child.signalCode === null) {
                child.kill();
                const force = setTimeout(() => child.kill('SIGKILL'), 500);
                force.unref();
                child.once('close', () => clearTimeout(force));
            }
            if (problem) reject(new UsageError(problem));
            else resolve(result);
        }
        const send = (message: object) => child.stdin.write(JSON.stringify(message) + '\n');
        signal.addEventListener('abort', abort, { once: true });
        child.once('error', () => finish('missing'));
        child.once('close', () => finish('closed'));
        child.stdin.on('error', () => finish('closed'));
        lines.on('error', () => finish('closed'));
        lines.on('line', line => {
            if (done) return;
            let msg: unknown;
            try { msg = JSON.parse(line); } catch { return finish('invalid'); }
            if (!record(msg)) return finish('invalid');
            if (msg.id !== pending || 'method' in msg) return;
            if (record(msg.error)) {
                const reason = String(msg.error.message);
                return finish(/401|unauthori[sz]ed|authenticat|log.?in|sign.?in|requires chatgpt|api.?key/i.test(reason) ? 'auth' : 'rpc');
            }
            if (!record(msg.result)) return finish('invalid');
            if (pending === 2) return finish(undefined, msg.result);
            send({ method: 'initialized' });
            pending++;
            send({ method: 'account/rateLimits/read', id: pending });
        });
        send({ method: 'initialize', id: pending, params: { clientInfo: {
            name: 'codex-usage-monitor', title: 'Codex Usage Monitor', version
        } } });
    });
}
