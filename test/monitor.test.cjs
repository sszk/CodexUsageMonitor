const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { normalize, severity, UsageError } = require('../out/usage');
const { readLimits } = require('../out/appServerClient');
const { Monitor } = require('../out/monitor');
const { locate } = require('../out/codexLocator');
const command = mode => ({ file: process.execPath, args: [path.join(__dirname, 'mock-server.cjs'), mode] });
const usage = (primary, secondary) => normalize({rateLimits: { primary, secondary }});
const read = (mode, timeout) => readLimits(command(mode), new AbortController().signal, timeout);

test('stdio handshake, notifications and real child process', async () => {
    assert.equal(normalize(await read('ok')).windows[0].remaining, 82);
});
for (const [mode, code] of [['auth', 'auth'], ['exit', 'closed'], ['rpc', 'rpc'], ['hang', 'timeout'], ['bad', 'invalid']]) {
    test('App Server ' + mode, async () => {
        await assert.rejects(read(mode, mode === 'hang' ? 150 : 3000), { problem: code });
    });
}
test('remaining percentage is clamped and floored', () => {
    for (const [used, remaining] of [[-8, 100], [1.2, 98], [99.99, 0], [140, 0]]) {
        assert.equal(usage({usedPercent: used}).windows[0].remaining, remaining);
    }
});
test('sort windows by duration and convert epoch seconds', () => {
    const [a, b] = usage({usedPercent: 5, windowDurationMins: 600},
        {usedPercent: 7, windowDurationMins: 30, resetsAt: 1730947200}).windows;
    assert.equal(a.minutes, 30);
    assert.equal(new Date(a.reset).toISOString(), '2024-11-07T02:40:00.000Z');
    assert.equal(b.minutes, 600);
});
test('prefer codex bucket, keep credits distinct from reset credits', () => {
    const result = normalize({ rateLimits: {primary: {usedPercent: 0}}, rateLimitsByLimitId: {
        spark: {}, codex: { secondary: {usedPercent: 80}, credits: {balance: '2.5'} }
    }, rateLimitResetCredits: {availableCount: 5} });
    assert.equal(result.windows[0], undefined);
    assert.equal(result.windows[1].remaining, 20);
    assert.equal(result.balance, '2.5');
    assert.throws(() => normalize({rateLimitsByLimitId: {spark: {}}}), {problem: 'unavailable'});
});
test('missing optional fields stay unknown', () => {
    const result = usage(null, {usedPercent: 77, resetsAt: null});
    assert.deepEqual(result.windows, [undefined, {remaining: 23, minutes: undefined, reset: undefined}]);
    assert.throws(() => usage(null, null), {problem: 'unavailable'});
});
test('invalid envelopes and fields', () => {
    for (const input of [null, {}, {rateLimitsByLimitId: []}, {rateLimits: {primary: {usedPercent: '9'}}}])
        assert.throws(() => normalize(input), {problem: 'invalid'});
});
test('warning and critical boundaries use the lowest known window', () => {
    for (const [remaining, expected] of [[21, undefined], [20, 'warning'], [6, 'warning'], [5, 'error'], [0, 'error']]) {
        const data = usage({usedPercent: 0}, {usedPercent: 100 - remaining});
        assert.equal(severity(data, true, 20, 5), expected);
        assert.equal(severity(data, false, 20, 5), undefined);
    }
});
test('deduplicate refreshes and retain last successful read on failure', async () => {
    let count = 0;
    const m = new Monitor(async () => {
        if (++count === 2) throw new UsageError('rpc');
        return usage({usedPercent: 5});
    }, () => {}, () => true);
    assert.equal(m.refresh(), m.refresh());
    await m.refresh();
    const stamp = m.updated;
    const original = m.usage;
    await m.refresh();
    assert.equal(m.updated, stamp);
    assert.equal(m.usage, original);
    assert.equal(m.failure, 'rpc');
    assert.equal(count, 2);
    m.dispose();
});
test('disposal cancels child, suppresses updates and stops polling', async () => {
    let reads = 0;
    let paints = 0;
    const m = new Monitor(signal => {
        reads++;
        return readLimits(command('hang'), signal);
    }, () => paints++, () => true);
    m.schedule(0.005);
    const pending = m.refresh();
    m.dispose();
    await pending;
    await new Promise(resolve => setTimeout(resolve, 30));
    await m.refresh();
    assert.deepEqual([reads, paints], [1, 0]);
});
test('explicit path takes precedence and must be absolute', async () => {
    assert.equal((await locate(process.execPath)).file, process.execPath);
    await assert.rejects(locate('./codex'), {problem: 'missing'});
});
