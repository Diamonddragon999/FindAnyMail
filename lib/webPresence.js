/**
 * DISIFY + Web Presence Checker
 * Free external verification that doesn't need port 25.
 *
 * - DISIFY API: free, no API key, checks MX, disposable, format
 * - Web search: checks if email appears in Google results (LinkedIn, GitHub, etc.)
 */

const DISIFY_TIMEOUT = 5000;

/**
 * Check an email via DISIFY free API.
 * Returns: { valid: bool, disposable: bool, dns: bool, format: bool }
 */
async function checkDisify(email) {
    try {
        const res = await fetch(`https://disify.com/api/email/${encodeURIComponent(email)}`, {
            signal: AbortSignal.timeout(DISIFY_TIMEOUT),
            headers: { 'User-Agent': 'FindAnyMail/2.0' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return {
            format: data.format ?? true,
            disposable: data.disposable ?? false,
            dns: data.dns ?? true,
            valid: (data.format !== false) && (data.disposable !== true) && (data.dns !== false),
        };
    } catch {
        return null;
    }
}

/**
 * Batch check emails via DISIFY (rate-limited to avoid abuse).
 * Only checks the top N candidates (default 5).
 */
async function batchDisifyCheck(emails, maxChecks = 5) {
    const results = new Map();
    const toCheck = emails.slice(0, maxChecks);

    // Sequential to respect rate limits
    for (const email of toCheck) {
        const result = await checkDisify(email);
        if (result) {
            results.set(email, result.valid);
        }
        // Small delay to be respectful
        if (toCheck.indexOf(email) < toCheck.length - 1) {
            await new Promise(r => setTimeout(r, 300));
        }
    }

    return results;
}

/**
 * Check if email appears in public web results.
 * Uses a simple Google search via HTML fetch.
 */
async function checkWebPresence(email) {
    try {
        const query = encodeURIComponent(`"${email}"`);
        const res = await fetch(`https://www.google.com/search?q=${query}&num=5`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return false;
        const html = await res.text();
        // Check if the email appears in actual search results (not in the search query itself)
        const resultSection = html.split('id="search"')[1] || html;
        return resultSection.includes(email);
    } catch {
        return false;
    }
}

module.exports = { checkDisify, batchDisifyCheck, checkWebPresence };
