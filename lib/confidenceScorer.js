/**
 * Confidence Scorer v2 — Overhauled multi-signal scoring.
 *
 * Key change: Website pattern match is now the PRIMARY signal when SMTP is unavailable.
 * The old scorer was way too dependent on SMTP — a website-detected pattern only got 25pts.
 * Now it gets 50pts, and combined with pattern frequency bonus, can push confident results
 * into the "likely" or even "verified" tier without SMTP.
 */

const SCORES = {
    // SMTP signals (strongest when available)
    smtpValid: 45,
    smtpInvalid: -999,   // instant kill

    // Website intelligence (strong signals)
    foundOnWebsite: 55,    // exact email found on the company's site
    websitePatternMatch: 50,    // matches pattern detected from other emails on site
    multipleWebsiteEmails: 10,    // bonus when pattern detected from 3+ emails on site

    // Provider intelligence
    providerPatternMatch: 15,    // pattern matches what this email provider typically uses

    // External verification
    gravatarFound: 15,    // has a Gravatar profile → email is real
    disifyValid: 20,    // DISIFY API says "format ok, not disposable, MX ok"

    // API enrichment
    aiRecommends: 15,
    hunterConfirms: 20,

    // Penalties
    catchAllPenalty: -20,    // on catch-all, SMTP valid means nothing
};

/**
 * Score a single email result with all available signals.
 */
function scoreEmail(params) {
    const {
        email, smtpStatus, patternWeight,
        matchesWebsitePattern, foundOnWebsite,
        matchesProviderPattern, hasGravatar,
        aiRecommended, hunterConfirmed,
        isCatchAll, disifyValid,
        websiteEmailCount,
    } = params;

    // SMTP invalid = definitely doesn't exist — instant kill
    if (smtpStatus === 'invalid') {
        return { email, score: 0, confidence: 'invalid', signals: ['smtp_rejected'], method: 'smtp_rejected' };
    }

    let score = 0;
    const signals = [];

    // ── SMTP signals ────────────────────
    if (smtpStatus === 'valid') {
        score += SCORES.smtpValid;
        signals.push('smtp_verified');
    }
    // Note: smtpStatus === 'error' means port 25 blocked — don't penalize at all

    // ── Website intelligence ────────────
    if (foundOnWebsite) {
        score += SCORES.foundOnWebsite;
        signals.push('found_on_website');
    }

    if (matchesWebsitePattern) {
        score += SCORES.websitePatternMatch;
        signals.push('website_pattern');
    }

    if ((websiteEmailCount || 0) >= 3 && matchesWebsitePattern) {
        score += SCORES.multipleWebsiteEmails;
        signals.push('strong_pattern');
    }

    // ── Provider intelligence ───────────
    if (matchesProviderPattern) {
        score += SCORES.providerPatternMatch;
        signals.push('provider_pattern');
    }

    // ── External checks ─────────────────
    if (hasGravatar) {
        score += SCORES.gravatarFound;
        signals.push('gravatar');
    }

    if (disifyValid) {
        score += SCORES.disifyValid;
        signals.push('disify_valid');
    }

    // ── AI & Enrichment ─────────────────
    if (aiRecommended) {
        score += SCORES.aiRecommends;
        signals.push('ai_pick');
    }

    if (hunterConfirmed) {
        score += SCORES.hunterConfirms;
        signals.push('hunter_verified');
    }

    // ── Pattern frequency bonus ─────────
    // Base weight 1-33, with boosts up to 83. Normalize to 3-20pt range
    // so every result gets at least a small base score.
    const rawWeight = patternWeight || 1;
    const patternBonus = Math.max(3, Math.min(20, Math.round(rawWeight / 60 * 20)));
    score += patternBonus;

    // ── Penalties ────────────────────────
    if (isCatchAll && smtpStatus === 'valid') {
        score += SCORES.catchAllPenalty;
        signals.push('catchall_domain');
    }

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    // ── Confidence tier ─────────────────
    let confidence;
    if (score >= 75) confidence = 'verified';
    else if (score >= 50) confidence = 'likely';
    else if (score >= 30) confidence = 'possible';
    else confidence = 'low';

    return { email, score, confidence, signals, method: signals[0] || 'pattern' };
}

/**
 * Score and rank all results. Filter out invalid and show top results.
 */
function scoreAndRank(results) {
    return results
        .map(r => scoreEmail(r))
        .filter(r => r.confidence !== 'invalid')
        .sort((a, b) => b.score - a.score);
}

module.exports = { scoreEmail, scoreAndRank, SCORES };
