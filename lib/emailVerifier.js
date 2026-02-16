/**
 * Email Verifier — Standalone email verification.
 * Takes an existing email address and verifies if it's real.
 */
const { getDomainIntelligence } = require('./dnsResolver');
const { verifyEmails, checkCatchAll } = require('./smtpVerifier');
const { hasGravatar } = require('./gravatarChecker');

/**
 * Verify a single email address.
 * @param {string} email
 * @returns {Promise<Object>}
 */
async function verifyEmail(email) {
    const start = Date.now();
    const normalized = email.toLowerCase().trim();

    // Basic format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(normalized)) {
        return {
            email: normalized,
            valid: false,
            reason: 'Invalid email format.',
            details: {},
            duration: Date.now() - start,
        };
    }

    const [, domain] = normalized.split('@');

    // DNS check
    const dnsInfo = await getDomainIntelligence(domain);
    if (!dnsInfo.hasMx) {
        return {
            email: normalized,
            valid: false,
            reason: dnsInfo.error || 'Domain has no mail server.',
            details: { domain, hasMx: false },
            duration: Date.now() - start,
        };
    }

    // SMTP + catch-all in parallel
    const [smtpResults, isCatchAll, gravatarExists] = await Promise.all([
        verifyEmails([normalized], dnsInfo.preferredMx),
        checkCatchAll(domain, dnsInfo.preferredMx),
        hasGravatar(normalized),
    ]);

    const smtpResult = smtpResults[0];

    let status, reason;
    if (smtpResult.status === 'valid') {
        if (isCatchAll) {
            status = 'risky';
            reason = 'Email accepted but domain is catch-all — accepts any address.';
        } else {
            status = 'valid';
            reason = 'Email exists on the mail server.';
        }
    } else if (smtpResult.status === 'invalid') {
        status = 'invalid';
        reason = 'Email rejected by mail server (mailbox does not exist).';
    } else {
        status = 'unknown';
        reason = 'Could not determine — SMTP returned inconclusive result.';
    }

    return {
        email: normalized,
        valid: status === 'valid',
        status,
        reason,
        details: {
            domain,
            provider: dnsInfo.provider,
            mxServer: dnsInfo.preferredMx,
            smtpCode: smtpResult.code,
            isCatchAll,
            hasGravatar: gravatarExists,
            isRoleBased: isRoleBased(normalized),
            isDisposable: false, // could add disposable domain list later
        },
        duration: Date.now() - start,
    };
}

/**
 * Check if an email is role-based (info@, support@, etc.)
 */
function isRoleBased(email) {
    const local = email.split('@')[0].toLowerCase();
    const roleAddresses = [
        'info', 'contact', 'support', 'office', 'hello', 'admin',
        'sales', 'hr', 'marketing', 'press', 'media', 'team',
        'jobs', 'careers', 'billing', 'help', 'noreply', 'no-reply',
        'webmaster', 'postmaster', 'abuse', 'security', 'feedback',
    ];
    return roleAddresses.includes(local);
}

/**
 * Batch verify multiple emails.
 */
async function batchVerify(emails, concurrency = 5) {
    const results = [];
    for (let i = 0; i < emails.length; i += concurrency) {
        const batch = emails.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(e => verifyEmail(e)));
        results.push(...batchResults);
    }
    return results;
}

module.exports = { verifyEmail, batchVerify, isRoleBased };
