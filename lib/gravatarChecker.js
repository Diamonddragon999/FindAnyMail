/**
 * Gravatar Checker
 * Checks if email addresses have Gravatar profiles (MD5 hash check).
 */
const crypto = require('crypto');

/**
 * Check if an email has a Gravatar profile.
 * @param {string} email
 * @returns {Promise<boolean>}
 */
async function hasGravatar(email) {
    try {
        const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
        const url = `https://gravatar.com/avatar/${hash}?d=404&s=1`;
        const res = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(4000),
        });
        return res.status === 200;
    } catch {
        return false;
    }
}

/**
 * Batch check Gravatar for multiple emails.
 * @param {string[]} emails
 * @returns {Promise<Map<string, boolean>>}
 */
async function batchGravatarCheck(emails) {
    const results = new Map();
    // Process 5 at a time
    for (let i = 0; i < emails.length; i += 5) {
        const batch = emails.slice(i, i + 5);
        const checks = await Promise.all(
            batch.map(async (email) => ({
                email,
                hasGravatar: await hasGravatar(email),
            }))
        );
        for (const c of checks) {
            results.set(c.email, c.hasGravatar);
        }
    }
    return results;
}

module.exports = { hasGravatar, batchGravatarCheck };
