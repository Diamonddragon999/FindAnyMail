/**
 * DNS Resolver + Provider Detection
 * MX lookup, SPF record, email provider identification.
 */
const dns = require('dns');
const { promisify } = require('util');
const { dnsCache } = require('./cache');

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);

// Known email providers by MX hostname patterns
const PROVIDERS = {
    'google': { name: 'Google Workspace', patterns: ['first.last', 'firstlast', 'first'] },
    'outlook': { name: 'Microsoft 365', patterns: ['first.last', 'flast', 'firstlast'] },
    'hotmail': { name: 'Microsoft 365', patterns: ['first.last', 'flast'] },
    'pphosted': { name: 'Proofpoint/Microsoft', patterns: ['first.last', 'flast'] },
    'zoho': { name: 'Zoho', patterns: ['first.last', 'first', 'firstlast'] },
    'protonmail': { name: 'ProtonMail', patterns: ['first.last', 'firstlast', 'first'] },
    'fastmail': { name: 'Fastmail', patterns: ['first.last', 'first'] },
    'mimecast': { name: 'Mimecast', patterns: ['first.last', 'flast'] },
    'barracuda': { name: 'Barracuda', patterns: ['first.last', 'flast'] },
};

/**
 * Detect email provider from MX hostname.
 */
function detectProvider(mxHost) {
    const host = mxHost.toLowerCase();
    for (const [key, info] of Object.entries(PROVIDERS)) {
        if (host.includes(key)) return { provider: info.name, preferredPatterns: info.patterns };
    }
    return { provider: 'Custom', preferredPatterns: null };
}

/**
 * Get MX records + provider info for a domain.
 */
async function getDomainIntelligence(domain) {
    const d = domain.toLowerCase().trim();
    const cached = dnsCache.get(`dns:${d}`);
    if (cached) return cached;

    const result = {
        domain: d,
        mxRecords: [],
        preferredMx: null,
        provider: 'Unknown',
        preferredPatterns: null,
        spfRecord: null,
        hasMx: false,
        error: null,
    };

    // MX lookup
    try {
        const records = await resolveMx(d);
        if (records && records.length > 0) {
            records.sort((a, b) => a.priority - b.priority);
            result.mxRecords = records;
            result.preferredMx = records[0].exchange;
            result.hasMx = true;

            const { provider, preferredPatterns } = detectProvider(records[0].exchange);
            result.provider = provider;
            result.preferredPatterns = preferredPatterns;
        } else {
            result.error = 'No MX records found.';
        }
    } catch (err) {
        result.error = err.code === 'ENOTFOUND' ? 'Domain does not exist.' :
            err.code === 'ENODATA' ? 'No MX records.' :
                `DNS error: ${err.message}`;
    }

    // SPF lookup (non-blocking)
    try {
        const txtRecords = await resolveTxt(d);
        const spf = txtRecords.flat().find(r => r.startsWith('v=spf1'));
        result.spfRecord = spf || null;
    } catch {
        // SPF is optional, ignore errors
    }

    dnsCache.set(`dns:${d}`, result);
    return result;
}

module.exports = { getDomainIntelligence, detectProvider };
