/**
 * Enrichment APIs — Optional third-party integrations.
 * Hunter.io, Apollo.io, Skrapp.io
 */

/**
 * Hunter.io — Domain email pattern search.
 * Free: 25 searches/month.
 */
async function hunterDomainSearch(domain) {
    const key = process.env.HUNTER_API_KEY;
    if (!key) return null;

    try {
        const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${key}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;

        const data = await res.json();
        const d = data.data;
        return {
            pattern: d.pattern || null,
            emails: (d.emails || []).map(e => ({
                email: e.value,
                type: e.type,
                confidence: e.confidence,
                firstName: e.first_name,
                lastName: e.last_name,
            })),
            organization: d.organization || null,
        };
    } catch {
        return null;
    }
}

/**
 * Hunter.io — Email finder by name + domain.
 */
async function hunterEmailFinder(firstName, lastName, domain) {
    const key = process.env.HUNTER_API_KEY;
    if (!key) return null;

    try {
        const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${key}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;

        const data = await res.json();
        return {
            email: data.data?.email || null,
            score: data.data?.score || 0,
            position: data.data?.position || null,
        };
    } catch {
        return null;
    }
}

/**
 * Run all available enrichment APIs.
 */
async function enrichWithApis(firstName, lastName, domain) {
    const results = {
        hunter: null,
        hunterFinder: null,
    };

    // Run in parallel
    const [hunterData, hunterFinderData] = await Promise.all([
        hunterDomainSearch(domain),
        hunterEmailFinder(firstName, lastName, domain),
    ]);

    results.hunter = hunterData;
    results.hunterFinder = hunterFinderData;

    return results;
}

module.exports = { hunterDomainSearch, hunterEmailFinder, enrichWithApis };
