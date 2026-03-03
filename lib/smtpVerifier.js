/**
 * SMTP Verifier — Multi-MX with retries and response classification.
 */
const net = require('net');

const SMTP_PORT = 25;
const TIMEOUT = 7000;
const HELO_DOMAIN = process.env.SMTP_HELO_DOMAIN || 'mail.findanymail.com';
const DEFAULT_MAX_RETRIES = 2;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseEnhancedCode(message = '') {
    const match = message.match(/\b([245]\.\d\.\d)\b/);
    return match ? match[1] : null;
}

function classifyResponse(code, message = '') {
    const text = message.toLowerCase();
    const enhancedCode = parseEnhancedCode(message);

    if (code === 250 || code === 251) {
        return { status: 'valid', category: 'accepted', retryable: false, enhancedCode };
    }

    if (code >= 550 && code <= 559) {
        if (text.includes('user unknown') || text.includes('unknown user') || text.includes('no such user') || text.includes('mailbox unavailable') || text.includes('recipient address rejected')) {
            return { status: 'invalid', category: 'mailbox_not_found', retryable: false, enhancedCode };
        }
        if (text.includes('quota') || text.includes('mailbox full')) {
            return { status: 'unknown', category: 'mailbox_full', retryable: true, enhancedCode };
        }
        if (text.includes('policy') || text.includes('denied') || text.includes('blocked') || text.includes('rate limit')) {
            return { status: 'unknown', category: 'policy_block', retryable: true, enhancedCode };
        }
        return { status: 'invalid', category: 'rejected_5xx', retryable: false, enhancedCode };
    }

    if (code >= 450 && code <= 459) {
        if (text.includes('greylist') || text.includes('try again')) {
            return { status: 'unknown', category: 'greylisted', retryable: true, enhancedCode };
        }
        return { status: 'unknown', category: 'temporary_failure', retryable: true, enhancedCode };
    }

    if (code === 421) {
        return { status: 'unknown', category: 'service_unavailable', retryable: true, enhancedCode };
    }

    if (code >= 500 && code <= 599) {
        return { status: 'unknown', category: 'server_error', retryable: false, enhancedCode };
    }

    return { status: 'unknown', category: 'inconclusive', retryable: true, enhancedCode };
}

function readResponse(socket) {
    return new Promise((resolve, reject) => {
        let buffer = '';
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('SMTP response timeout'));
        }, TIMEOUT);

        const onData = (data) => {
            buffer += data.toString();
            const lines = buffer.split('\r\n').filter(Boolean);
            const lastLine = lines[lines.length - 1];
            if (lastLine && lastLine.length >= 4 && lastLine[3] === ' ') {
                const code = parseInt(lastLine.substring(0, 3), 10);
                cleanup();
                resolve({ code, message: buffer.trim() });
            }
        };

        const onError = (err) => {
            cleanup();
            reject(err);
        };

        const cleanup = () => {
            clearTimeout(timer);
            socket.removeListener('data', onData);
            socket.removeListener('error', onError);
        };

        socket.on('data', onData);
        socket.on('error', onError);
    });
}

async function sendCommand(socket, command) {
    return new Promise((resolve, reject) => {
        socket.write(`${command}\r\n`, (err) => {
            if (err) return reject(err);
            readResponse(socket).then(resolve).catch(reject);
        });
    });
}

async function verifyOnMx(emails, mxHost, heloDomain) {
    const results = [];
    const socket = await new Promise((resolve, reject) => {
        const s = net.createConnection({ host: mxHost, port: SMTP_PORT, timeout: TIMEOUT });
        const timer = setTimeout(() => {
            s.destroy();
            reject(new Error('Connection timeout'));
        }, TIMEOUT);

        s.once('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
        s.once('connect', () => {
            clearTimeout(timer);
            resolve(s);
        });
    });

    socket.setEncoding('utf8');
    socket.setTimeout(TIMEOUT);

    try {
        const greeting = await readResponse(socket);
        if (greeting.code !== 220) throw new Error(`Bad greeting: ${greeting.code}`);

        const ehlo = await sendCommand(socket, `EHLO ${heloDomain}`);
        if (ehlo.code !== 250) throw new Error(`EHLO rejected: ${ehlo.code}`);

        for (const email of emails) {
            try {
                const mailFrom = await sendCommand(socket, 'MAIL FROM:<>');
                if (mailFrom.code !== 250) {
                    const fallback = await sendCommand(socket, `MAIL FROM:<verify@${heloDomain}>`);
                    if (fallback.code !== 250) {
                        const classifiedFallback = classifyResponse(fallback.code, fallback.message);
                        results.push({
                            email,
                            mxHost,
                            code: fallback.code,
                            message: fallback.message,
                            enhancedCode: classifiedFallback.enhancedCode,
                            status: 'unknown',
                            category: 'mailfrom_rejected',
                            retryable: true,
                        });
                        continue;
                    }
                }

                const rcpt = await sendCommand(socket, `RCPT TO:<${email}>`);
                const classified = classifyResponse(rcpt.code, rcpt.message);
                results.push({
                    email,
                    mxHost,
                    code: rcpt.code,
                    message: rcpt.message,
                    enhancedCode: classified.enhancedCode,
                    status: classified.status,
                    category: classified.category,
                    retryable: classified.retryable,
                });

                try { await sendCommand(socket, 'RSET'); } catch { }
            } catch (err) {
                results.push({
                    email,
                    mxHost,
                    code: null,
                    message: err.message,
                    enhancedCode: null,
                    status: 'error',
                    category: 'session_error',
                    retryable: true,
                });
            }
        }

        try { socket.write('QUIT\r\n'); } catch { }
    } finally {
        socket.destroy();
    }

    return results;
}

function mergeResult(current, incoming) {
    if (!current) return incoming;
    if (incoming.status === 'valid' || incoming.status === 'invalid') return incoming;
    if (current.status === 'valid' || current.status === 'invalid') return current;

    const score = { unknown: 2, error: 1 };
    if ((score[incoming.status] || 0) >= (score[current.status] || 0)) return incoming;
    return current;
}

async function verifyEmails(emails, mxHostsOrHost, options = {}) {
    const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : DEFAULT_MAX_RETRIES;
    const heloDomain = options.heloDomain || HELO_DOMAIN;
    const uniqueEmails = [...new Set(emails.map(e => e.toLowerCase()))];
    const mxHosts = Array.isArray(mxHostsOrHost)
        ? [...new Set(mxHostsOrHost.filter(Boolean))]
        : (mxHostsOrHost ? [mxHostsOrHost] : []);

    const resultMap = new Map();
    for (const email of uniqueEmails) {
        resultMap.set(email, {
            email,
            status: 'error',
            code: null,
            message: 'No MX hosts available',
            category: 'no_mx',
            enhancedCode: null,
            mxHost: null,
            attempts: 0,
        });
    }

    if (mxHosts.length === 0) return uniqueEmails.map(email => resultMap.get(email));

    let pending = new Set(uniqueEmails);

    for (const mxHost of mxHosts) {
        if (pending.size === 0) break;

        let attempt = 0;
        while (attempt <= maxRetries && pending.size > 0) {
            const toCheck = [...pending];
            let batchResults = [];

            try {
                batchResults = await verifyOnMx(toCheck, mxHost, heloDomain);
            } catch (err) {
                batchResults = toCheck.map(email => ({
                    email,
                    mxHost,
                    code: null,
                    message: err.message,
                    enhancedCode: null,
                    status: 'error',
                    category: 'connection_error',
                    retryable: true,
                }));
            }

            const nextPending = new Set();
            for (const res of batchResults) {
                const existing = resultMap.get(res.email);
                const merged = mergeResult(existing, {
                    ...res,
                    attempts: (existing?.attempts || 0) + 1,
                });
                resultMap.set(res.email, merged);

                if (merged.status === 'valid' || merged.status === 'invalid') {
                    continue;
                }

                if (res.retryable && attempt < maxRetries) {
                    nextPending.add(res.email);
                }
            }

            pending = new Set([...pending].filter(email => !batchResults.find(r => r.email === email && (r.status === 'valid' || r.status === 'invalid'))));
            if (nextPending.size === 0) break;

            attempt += 1;
            pending = nextPending;
            await sleep(Math.min(1500, 300 * Math.pow(2, attempt) + Math.floor(Math.random() * 120)));
        }

        pending = new Set([...resultMap.values()].filter(r => r.status !== 'valid' && r.status !== 'invalid').map(r => r.email));
    }

    return uniqueEmails.map(email => resultMap.get(email));
}

async function checkCatchAll(domain, mxHostsOrHost, options = {}) {
    const garbage = `xq9z7m2k4j_test_${Date.now()}@${domain}`;
    const results = await verifyEmails([garbage], mxHostsOrHost, options);
    return results[0]?.status === 'valid';
}

module.exports = {
    verifyEmails,
    checkCatchAll,
    classifyResponse,
    parseEnhancedCode,
};
