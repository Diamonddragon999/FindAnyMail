/**
 * Domain Search — Find all known emails for a domain.
 * Crawls the website, checks patterns, returns all discovered addresses.
 */
const { getDomainIntelligence } = require('./dnsResolver');
const { scrapeWebsite } = require('./websiteScraper');
const { verifyEmails, checkCatchAll } = require('./smtpVerifier');

/**
 * Search a domain for all discoverable email addresses.
 */
async function searchDomain(domain) {
    const start = Date.now();
    const d = domain.toLowerCase().trim();

    // DNS
    const dnsInfo = await getDomainIntelligence(d);
    if (!dnsInfo.hasMx) {
        return {
            domain: d,
            emails: [],
            error: dnsInfo.error || 'No mail server found.',
            duration: Date.now() - start,
        };
    }

    // Scrape website for emails + check catch-all
    const [scraperResult, isCatchAll] = await Promise.all([
        scrapeWebsite(d),
        checkCatchAll(d, dnsInfo.preferredMx),
    ]);

    // SMTP verify all found domain emails
    const domainEmails = scraperResult.domainEmails;
    let verifiedEmails = [];

    if (domainEmails.length > 0) {
        const smtpResults = await verifyEmails(domainEmails, dnsInfo.preferredMx);
        verifiedEmails = smtpResults.map(r => ({
            email: r.email,
            smtpStatus: r.status,
            smtpCode: r.code,
            verified: r.status === 'valid',
        }));
    }

    return {
        domain: d,
        provider: dnsInfo.provider,
        mxServer: dnsInfo.preferredMx,
        isCatchAll,
        detectedPattern: scraperResult.detectedPattern,
        emailsFound: domainEmails.length,
        emails: verifiedEmails.length > 0 ? verifiedEmails : domainEmails.map(e => ({
            email: e,
            smtpStatus: 'not_checked',
            verified: false,
        })),
        pagesScraped: scraperResult.emailsFound?.length || 0,
        duration: Date.now() - start,
    };
}

module.exports = { searchDomain };
