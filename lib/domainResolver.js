/**
 * Domain Resolver
 * Resolves company name → domain using Clearbit Autocomplete API (free, no key).
 */
const { domainCache } = require('./cache');

/**
 * Resolve a company name to its domain.
 * @param {string} companyName
 * @returns {Promise<{domain: string|null, name: string|null, logo: string|null}>}
 */
async function resolveCompanyDomain(companyName) {
    const query = companyName.trim().toLowerCase();
    if (!query) return { domain: null, name: null, logo: null };

    const cached = domainCache.get(`company:${query}`);
    if (cached) return cached;

    try {
        const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
            return { domain: null, name: null, logo: null };
        }

        const data = await res.json();

        if (!data || data.length === 0) {
            return { domain: null, name: null, logo: null };
        }

        // Return the top result
        const top = data[0];
        const result = {
            domain: top.domain || null,
            name: top.name || null,
            logo: top.logo || null,
        };

        domainCache.set(`company:${query}`, result);
        return result;

    } catch {
        return { domain: null, name: null, logo: null };
    }
}

/**
 * Determine if a string looks like a domain or a company name.
 * @param {string} input
 * @returns {boolean} true if it looks like a domain
 */
function isDomain(input) {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/.test(input.trim());
}

module.exports = { resolveCompanyDomain, isDomain };
