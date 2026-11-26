import { constants, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { Command } from './appServerClient';
import { UsageError } from './usage';

const windows = process.platform === 'win32';
const binary = windows ? 'codex.exe' : 'codex';
async function executable(file: string) {
    try {
        if (!(await fs.stat(file)).isFile()) return false;
        await fs.access(file, windows ? constants.F_OK : constants.X_OK);
        return true;
    } catch { return false; }
}
// Resolve npm's Windows shim to the packaged native binary. No command interpreter.
async function candidate(file: string): Promise<Command | undefined> {
    if (!path.isAbsolute(file) || !(await executable(file))) return;
    if (!windows || /\.exe$/i.test(file)) return { file, args: [] };
    if (!/^codex\.(cmd|ps1)$/i.test(path.basename(file))) return;
    const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
    const vendor = path.join('vendor', arch + '-pc-windows-msvc');
    const modules = path.join(path.dirname(file), 'node_modules', '@openai');
    const platformPackage = 'codex-win32-' + (process.arch === 'arm64' ? 'arm64' : 'x64');
    for (const base of [path.join(modules, 'codex', 'node_modules', '@openai', platformPackage),
        path.join(modules, platformPackage), path.join(modules, 'codex')]) {
        for (const layout of ['bin', 'codex']) {
            const native = path.join(base, vendor, layout, binary);
            if (await executable(native)) return { file: native, args: [] };
        }
    }
}
export async function locate(configured: string, bundle?: string): Promise<Command> {
    if (configured) {
        const command = await candidate(configured);
        if (command) return command;
        throw new UsageError('missing');
    }
    const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(path.isAbsolute);
    if (process.platform === 'darwin') dirs.push('/opt/homebrew/bin', '/usr/local/bin');
    if (!windows) dirs.push(path.join(homedir(), '.local', 'bin'));
    for (const dir of new Set(dirs)) {
        for (const name of windows ? [binary, 'codex.cmd'] : [binary]) {
            const command = await candidate(path.join(dir, name));
            if (command) return command;
        }
    }
    if (bundle) {
        const os = { darwin: 'macos', linux: 'linux', win32: 'windows' }[process.platform as string];
        const cpu = { arm64: 'aarch64', x64: 'x86_64' }[process.arch as string];
        if (os && cpu) {
            const file = path.join(bundle, 'bin', os + '-' + cpu, binary);
            try {
                const real = await fs.realpath(file);
                if (real.startsWith(await fs.realpath(bundle) + path.sep) && await executable(real))
                    return { file: real, args: [] };
            } catch { /* Optional bundle layout varies across releases. */ }
        }
    }
    throw new UsageError('missing');
}
