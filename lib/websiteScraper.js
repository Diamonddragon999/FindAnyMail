/**
 * Website Scraper
 * Crawls company website to find email addresses and detect patterns.
 */
const cheerio = require('cheerio');
const { scraperCache } = require('./cache');

const PATHS_TO_CRAWL = [
    '/', '/about', '/about-us', '/team', '/our-team',
    '/contact', '/contact-us', '/people', '/staff',
    '/company', '/leadership', '/management',
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const TIMEOUT = 6000;

/**
 * Fetch a single page and extract emails.
 */
async function fetchPage(url) {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; FindAnyMail/2.0)',
                'Accept': 'text/html',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(TIMEOUT),
        });
        if (!res.ok) return [];
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) return [];
        const html = await res.text();
        return extractEmails(html);
    } catch {
        return [];
    }
}

/**
 * Extract email addresses from HTML content.
 */
function extractEmails(html) {
    const $ = cheerio.load(html);
    // Remove scripts and styles
    $('script, style, noscript').remove();
    const text = $.text() + ' ' + $('a[href^="mailto:"]').map((_, el) => $(el).attr('href').replace('mailto:', '')).get().join(' ');
    const matches = text.match(EMAIL_REGEX) || [];
    // Clean and deduplicate
    const cleaned = [...new Set(matches.map(e => e.toLowerCase().trim()))];
    // Filter out common noise
    return cleaned.filter(e =>
        !e.includes('example.com') &&
        !e.includes('sentry') &&
        !e.includes('wixpress') &&
        !e.includes('webpack') &&
        !e.endsWith('.png') &&
        !e.endsWith('.jpg') &&
        e.length < 80
    );
}

/**
 * Detect the email pattern from a list of found emails.
 * Returns the most likely pattern ID or null.
 */
function detectPattern(emails, domain) {
    const domainEmails = emails.filter(e => e.endsWith(`@${domain}`));
    if (domainEmails.length === 0) return { pattern: null, sampleEmails: [] };

    // Look at the local parts
    const locals = domainEmails.map(e => e.split('@')[0]);

    // Check for common patterns
    const patterns = {};
    for (const local of locals) {
        // Skip generic addresses
        if (['info', 'contact', 'support', 'office', 'hello', 'admin', 'sales', 'hr', 'marketing', 'press', 'media', 'team', 'jobs', 'careers', 'billing', 'help', 'no-reply', 'noreply', 'webmaster', 'postmaster'].includes(local)) continue;

        if (local.includes('.')) {
            const parts = local.split('.');
            if (parts.length === 2 && parts[0].length > 1 && parts[1].length > 1) {
                patterns['first.last'] = (patterns['first.last'] || 0) + 1;
            } else if (parts.length === 2 && parts[0].length === 1) {
                patterns['f.last'] = (patterns['f.last'] || 0) + 1;
            } else if (parts.length === 2 && parts[1].length === 1) {
                patterns['first.l'] = (patterns['first.l'] || 0) + 1;
            }
        } else if (local.includes('_')) {
            patterns['first_last'] = (patterns['first_last'] || 0) + 1;
        } else if (local.includes('-')) {
            patterns['first-last'] = (patterns['first-last'] || 0) + 1;
        } else if (local.length <= 15 && /^[a-z]+$/.test(local)) {
            // Could be first, last, or firstlast — hard to tell without more context
            patterns['firstlast'] = (patterns['firstlast'] || 0) + 1;
        }
    }

    // Find the most common pattern
    let topPattern = null;
    let topCount = 0;
    for (const [p, count] of Object.entries(patterns)) {
        if (count > topCount) {
            topPattern = p;
            topCount = count;
        }
    }

    return {
        pattern: topPattern,
        sampleEmails: domainEmails.slice(0, 5),
        patternCounts: patterns,
    };
}

/**
 * Scrape a domain's website for email intelligence.
 */
async function scrapeWebsite(domain) {
    const d = domain.toLowerCase().trim();
    const cached = scraperCache.get(`scrape:${d}`);
    if (cached) return cached;

    const foundEmails = new Set();

    // Try both https and http
    const baseUrls = [`https://${d}`, `https://www.${d}`];

    // Crawl pages concurrently (limit to 3 at a time)
    for (const base of baseUrls) {
        const batchSize = 3;
        for (let i = 0; i < PATHS_TO_CRAWL.length; i += batchSize) {
            const batch = PATHS_TO_CRAWL.slice(i, i + batchSize);
            const results = await Promise.all(
                batch.map(path => fetchPage(`${base}${path}`))
            );
            for (const emails of results) {
                for (const email of emails) {
                    foundEmails.add(email);
                }
            }
        }
        // If we found emails on the first base URL, don't try www variant
        if (foundEmails.size > 0) break;
    }

    const emailList = [...foundEmails];
    const patternInfo = detectPattern(emailList, d);

    const result = {
        domain: d,
        emailsFound: emailList,
        domainEmails: emailList.filter(e => e.endsWith(`@${d}`)),
        externalEmails: emailList.filter(e => !e.endsWith(`@${d}`)),
        detectedPattern: patternInfo.pattern,
        sampleEmails: patternInfo.sampleEmails,
    };

    scraperCache.set(`scrape:${d}`, result);
    return result;
}

module.exports = { scrapeWebsite, extractEmails, detectPattern };
