/**
 * SMTP Verifier — Single-Connection Multi-RCPT
 * Opens one TCP connection to the mail server and verifies all patterns.
 */
const net = require('net');

const SMTP_PORT = 25;
const TIMEOUT = 5000;  // 5s — fail fast when port 25 blocked
const HELO_DOMAIN = 'mail.findanymail.com';

/**
 * Read a complete SMTP response (may span multiple lines).
 */
function readResponse(socket) {
    return new Promise((resolve, reject) => {
        let buffer = '';
        const timer = setTimeout(() => {
            reject(new Error('SMTP response timeout'));
        }, TIMEOUT);

        const onData = (data) => {
            buffer += data.toString();
            // SMTP multi-line responses have - after code, final line has space
            const lines = buffer.split('\r\n').filter(l => l.length > 0);
            const lastLine = lines[lines.length - 1];
            if (lastLine && lastLine.length >= 4 && lastLine[3] === ' ') {
                clearTimeout(timer);
                socket.removeListener('data', onData);
                socket.removeListener('error', onError);
                const code = parseInt(lastLine.substring(0, 3), 10);
                resolve({ code, message: buffer.trim() });
            }
        };

        const onError = (err) => {
            clearTimeout(timer);
            socket.removeListener('data', onData);
            reject(err);
        };

        socket.on('data', onData);
        socket.once('error', onError);
    });
}

/**
 * Send an SMTP command and wait for response.
 */
async function sendCommand(socket, command) {
    return new Promise((resolve, reject) => {
        socket.write(command + '\r\n', (err) => {
            if (err) reject(err);
            else readResponse(socket).then(resolve).catch(reject);
        });
    });
}

/**
 * Verify multiple emails via a single SMTP connection.
 * Returns results for each email.
 *
 * @param {string[]} emails
 * @param {string} mxHost
 * @returns {Promise<Array<{email: string, status: string, code: number|null}>>}
 */
async function verifyEmails(emails, mxHost) {
    const results = [];

    try {
        // Connect
        const socket = await new Promise((resolve, reject) => {
            const s = net.createConnection({ host: mxHost, port: SMTP_PORT, timeout: TIMEOUT });
            const timer = setTimeout(() => {
                s.destroy();
                reject(new Error('Connection timeout'));
            }, TIMEOUT);
            s.once('error', (err) => { clearTimeout(timer); reject(err); });
            s.once('connect', () => { clearTimeout(timer); resolve(s); });
        });

        socket.setEncoding('utf8');
        socket.setTimeout(TIMEOUT);

        try {
            // Read greeting
            const greeting = await readResponse(socket);
            if (greeting.code !== 220) {
                throw new Error(`Bad greeting: ${greeting.code}`);
            }

            // EHLO
            const ehlo = await sendCommand(socket, `EHLO ${HELO_DOMAIN}`);
            if (ehlo.code !== 250) {
                throw new Error(`EHLO rejected: ${ehlo.code}`);
            }

            // Verify each email
            for (let i = 0; i < emails.length; i++) {
                try {
                    // MAIL FROM (reset for each)
                    const mailFrom = await sendCommand(socket, 'MAIL FROM:<>');
                    if (mailFrom.code !== 250) {
                        // Some servers don't accept empty sender, try with address
                        const mailFrom2 = await sendCommand(socket, `MAIL FROM:<verify@${HELO_DOMAIN}>`);
                        if (mailFrom2.code !== 250) {
                            results.push({ email: emails[i], status: 'error', code: mailFrom2.code });
                            continue;
                        }
                    }

                    // RCPT TO — this is the verdict
                    const rcpt = await sendCommand(socket, `RCPT TO:<${emails[i]}>`);

                    if (rcpt.code === 250 || rcpt.code === 251) {
                        results.push({ email: emails[i], status: 'valid', code: rcpt.code });
                    } else if (rcpt.code >= 550 && rcpt.code <= 559) {
                        results.push({ email: emails[i], status: 'invalid', code: rcpt.code });
                    } else if (rcpt.code >= 450 && rcpt.code <= 459) {
                        results.push({ email: emails[i], status: 'unknown', code: rcpt.code });
                    } else {
                        results.push({ email: emails[i], status: 'unknown', code: rcpt.code });
                    }

                    // RSET for next email
                    await sendCommand(socket, 'RSET');

                } catch (err) {
                    results.push({ email: emails[i], status: 'error', code: null });
                }
            }

            // Quit
            try { socket.write('QUIT\r\n'); } catch { }
        } finally {
            socket.destroy();
        }

    } catch (err) {
        // Complete connection failure — mark all as error
        for (const email of emails) {
            if (!results.find(r => r.email === email)) {
                results.push({ email, status: 'error', code: null });
            }
        }
    }

    return results;
}

/**
 * Check if a domain is catch-all by testing a garbage address.
 */
async function checkCatchAll(domain, mxHost) {
    const garbage = `xq9z7m2k4j_test_${Date.now()}@${domain}`;
    const results = await verifyEmails([garbage], mxHost);
    return results[0]?.status === 'valid';
}

module.exports = { verifyEmails, checkCatchAll };
