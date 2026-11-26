const { createInterface } = require('node:readline');
const mode = process.argv[2];
let stage = 0;
const send = data => process.stdout.write(JSON.stringify(data) + '\n');
createInterface({ input: process.stdin }).on('line', line => {
    const msg = JSON.parse(line);
    const methods = ['initialize', 'initialized', 'account/rateLimits/read'];
    if (msg.method !== methods[stage++]) process.exit(5);
    if (msg.method === 'initialize') {
        if (!msg.params.clientInfo.name) process.exit(6);
        send({ method: 'account/updated', params: {} });
        send({ id: msg.id, result: {} });
    }
    if (msg.method !== 'account/rateLimits/read') return;
    switch (mode) {
        case 'hang': break;
        case 'exit': process.exit(7); break;
        case 'bad': process.stdout.write('broken json\n'); break;
        case 'auth': send({ id: msg.id, error: { message: 'ChatGPT authentication required' } }); break;
        case 'rpc': send({ id: msg.id, error: { message: 'connection refused' } }); break;
        default: send({ id: msg.id, result: { rateLimits: { primary: { usedPercent: 18 } } } });
    }
});
