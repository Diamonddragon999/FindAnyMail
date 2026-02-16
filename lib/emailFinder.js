/**
 * Email Finder v2 — Main Orchestrator (Overhauled)
 *
 * Key fixes from v1:
 * - Gravatar now checks ALL top candidates, not just SMTP-valid ones
 * - DISIFY free API added as an SMTP-independent verification layer
 * - Website pattern now properly weighted in scoring
 * - Pipeline handles SMTP failure gracefully without destroying confidence
 * - Passes websiteEmailCount to scorer for strong-pattern bonus
 */
const { resolveCompanyDomain, isDomain } = require('./domainResolver');
const { getDomainIntelligence } = require('./dnsResolver');
const { scrapeWebsite } = require('./websiteScraper');
const { generatePatterns } = require('./patternGenerator');
const { verifyEmails, checkCatchAll } = require('./smtpVerifier');
const { batchGravatarCheck } = require('./gravatarChecker');
const { analyzeWithAI } = require('./aiAnalyzer');
const { enrichWithApis } = require('./enrichmentApis');
const { batchDisifyCheck } = require('./webPresence');
const { scoreAndRank } = require('./confidenceScorer');

/**
 * Find email addresses for a person.
 */
async function findEmail({ firstName, lastName, domainOrCompany }) {
    const startTime = Date.now();
    const meta = { steps: [], warnings: [] };

    // ── L0: Domain Resolution ──────────────────────
    let domain = domainOrCompany.trim();
    let companyInfo = null;

    if (!isDomain(domain)) {
        meta.steps.push('Resolving company domain...');
        companyInfo = await resolveCompanyDomain(domain);
        if (!companyInfo.domain) {
            return {
                results: [],
                meta: {
                    domain: null,
                    error: `Could not resolve domain for "${domain}". Try providing the domain directly (e.g. company.com).`,
                    duration: Date.now() - startTime,
                },
            };
        }
        domain = companyInfo.domain;
        meta.steps.push(`Resolved to: ${domain}`);
    }

    // ── L1: Domain Intelligence ────────────────────
    meta.steps.push('Analyzing domain...');
    const dnsInfo = await getDomainIntelligence(domain);

    if (!dnsInfo.hasMx) {
        return {
            results: [],
            meta: {
                domain,
                provider: null,
                error: dnsInfo.error || 'Domain has no mail server.',
                duration: Date.now() - startTime,
            },
        };
    }

    // ── L2: Website Scraping + Catch-All (parallel) ──
    meta.steps.push('Scraping website + checking catch-all...');
    const [scraperResult, isCatchAll] = await Promise.all([
        scrapeWebsite(domain),
        checkCatchAll(domain, dnsInfo.preferredMx),
    ]);

    if (isCatchAll) {
        meta.warnings.push('Domain is catch-all — SMTP verification is unreliable.');
    }

    // Check if target email was found directly on website
    const targetEmailsOnSite = scraperResult.domainEmails.filter(e => {
        const local = e.split('@')[0].toLowerCase();
        const f = firstName.toLowerCase();
        const l = lastName.toLowerCase();
        return local.includes(f) || local.includes(l);
    });

    const websiteEmailCount = scraperResult.domainEmails.length;

    // ── L3: Pattern Generation ─────────────────────
    meta.steps.push('Generating patterns...');
    const patterns = generatePatterns(firstName, lastName, domain, {
        detectedPattern: scraperResult.detectedPattern,
        providerPatterns: dnsInfo.preferredPatterns,
    });

    // ── L4: SMTP Verification ─────────────────────
    meta.steps.push('SMTP verification...');
    const smtpResults = await verifyEmails(patterns.map(p => p.email), dnsInfo.preferredMx);

    const smtpWorked = smtpResults.some(r => r.status === 'valid' || r.status === 'invalid');
    if (!smtpWorked) {
        meta.warnings.push('SMTP verification unavailable (port 25 blocked). Using alternative signals.');
    }

    // ── L5: Gravatar + DISIFY (run on ALL top candidates, not just SMTP-valid) ──
    meta.steps.push('Checking profiles + validation...');

    // Get top 8 candidates by pattern weight for external checks
    const topCandidates = patterns.slice(0, 8).map(p => p.email);

    const [gravatarResults, disifyResults] = await Promise.all([
        batchGravatarCheck(topCandidates),
        batchDisifyCheck(topCandidates, 5),  // DISIFY: check top 5
    ]);

    // ── L6: AI Analysis (optional) ──
    let aiResult = { bestEmail: null, reasoning: '', confidence: 0 };
    if (process.env.OPENAI_API_KEY) {
        meta.steps.push('AI analysis...');
        aiResult = await analyzeWithAI({
            firstName, lastName, domain,
            provider: dnsInfo.provider,
            detectedPattern: scraperResult.detectedPattern,
            smtpResults,
            websiteEmails: scraperResult.domainEmails,
            isCatchAll,
        });
    }

    // ── L7: API Enrichment (optional) ─────
    let enrichment = { hunter: null, hunterFinder: null };
    if (process.env.HUNTER_API_KEY) {
        meta.steps.push('API enrichment...');
        enrichment = await enrichWithApis(firstName, lastName, domain);
    }

    // ── Build & Score Results ──────────────────────
    meta.steps.push('Scoring results...');
    const scoringInput = patterns.map(p => {
        const smtp = smtpResults.find(r => r.email === p.email);
        const smtpStatus = smtp?.status || 'error';
        const hasGrav = gravatarResults.get(p.email) || false;
        const disifyValid = disifyResults.get(p.email) || false;

        return {
            email: p.email,
            smtpStatus,
            patternWeight: p.weight,
            matchesWebsitePattern: scraperResult.detectedPattern === p.pattern,
            foundOnWebsite: targetEmailsOnSite.includes(p.email) || scraperResult.domainEmails.includes(p.email),
            matchesProviderPattern: dnsInfo.preferredPatterns?.includes(p.pattern) || false,
            hasGravatar: hasGrav,
            disifyValid,
            aiRecommended: aiResult.bestEmail === p.email,
            hunterConfirmed: enrichment.hunterFinder?.email === p.email,
            isCatchAll,
            websiteEmailCount,
        };
    });

    const ranked = scoreAndRank(scoringInput);

    return {
        results: ranked,
        meta: {
            domain,
            company: companyInfo?.name || null,
            provider: dnsInfo.provider,
            mxServer: dnsInfo.preferredMx,
            isCatchAll,
            detectedPattern: scraperResult.detectedPattern,
            websiteEmailsFound: websiteEmailCount,
            totalPatterns: patterns.length,
            smtpVerified: smtpResults.filter(r => r.status === 'valid').length,
            smtpRejected: smtpResults.filter(r => r.status === 'invalid').length,
            smtpAvailable: smtpWorked,
            gravatarHits: [...gravatarResults.values()].filter(Boolean).length,
            disifyChecked: disifyResults.size,
            aiAnalysis: aiResult.bestEmail ? { email: aiResult.bestEmail, reasoning: aiResult.reasoning } : null,
            hunterResult: enrichment.hunterFinder?.email || null,
            duration: Date.now() - startTime,
            steps: meta.steps,
            warnings: meta.warnings,
        },
    };
}

module.exports = { findEmail };
