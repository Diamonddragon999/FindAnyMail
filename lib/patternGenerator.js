/**
 * Smart Pattern Generator
 * Generates email permutations weighted by intelligence from other layers.
 */

// Patterns ordered by real-world frequency
const ALL_PATTERNS = [
    { id: 'first.last', fn: (f, l) => `${f}.${l}`, weight: 33 },
    { id: 'first', fn: (f, l) => `${f}`, weight: 15 },
    { id: 'flast', fn: (f, l) => `${f[0]}${l}`, weight: 13 },
    { id: 'firstlast', fn: (f, l) => `${f}${l}`, weight: 10 },
    { id: 'first_last', fn: (f, l) => `${f}_${l}`, weight: 5 },
    { id: 'f.last', fn: (f, l) => `${f[0]}.${l}`, weight: 5 },
    { id: 'last.first', fn: (f, l) => `${l}.${f}`, weight: 4 },
    { id: 'firstl', fn: (f, l) => `${f}${l[0]}`, weight: 3 },
    { id: 'last', fn: (f, l) => `${l}`, weight: 3 },
    { id: 'lastfirst', fn: (f, l) => `${l}${f}`, weight: 2 },
    { id: 'last_first', fn: (f, l) => `${l}_${f}`, weight: 2 },
    { id: 'lastf', fn: (f, l) => `${l}${f[0]}`, weight: 2 },
    { id: 'last.f', fn: (f, l) => `${l}.${f[0]}`, weight: 1 },
    { id: 'first-last', fn: (f, l) => `${f}-${l}`, weight: 1 },
    { id: 'f_last', fn: (f, l) => `${f[0]}_${l}`, weight: 1 },
    { id: 'first.l', fn: (f, l) => `${f}.${l[0]}`, weight: 1 },
];

/**
 * Map pattern ID strings to the actual pattern templates.
 */
const PATTERN_MAP = {};
for (const p of ALL_PATTERNS) {
    PATTERN_MAP[p.id] = p;
}

/**
 * Generate email candidates based on intelligence.
 *
 * @param {string} firstName
 * @param {string} lastName
 * @param {string} domain
 * @param {Object} options
 * @param {string|null} options.detectedPattern - Pattern from website scraping
 * @param {string[]|null} options.providerPatterns - Preferred patterns from provider
 * @returns {Array<{email: string, pattern: string, weight: number}>}
 */
function generatePatterns(firstName, lastName, domain, options = {}) {
    // Handle multiple names: "John David" → take first word, "Smith Johnson" → take last word
    const firstParts = firstName.toLowerCase().trim().split(/\s+/);
    const lastParts = lastName.toLowerCase().trim().split(/\s+/);

    const f = firstParts[0].replace(/[^a-z]/g, '');  // First word of first name
    const l = lastParts[lastParts.length - 1].replace(/[^a-z]/g, '');  // Last word of last name
    const d = domain.toLowerCase().trim();

    if (!f || !l || !d) {
        throw new Error('First name, last name, and domain are required.');
    }

    const seen = new Set();
    const results = [];

    const addPattern = (template, extraWeight = 0) => {
        const local = template.fn(f, l);
        const email = `${local}@${d}`;
        if (!seen.has(email)) {
            seen.add(email);
            results.push({
                email,
                pattern: template.id,
                weight: template.weight + extraWeight,
            });
        }
    };

    const { detectedPattern, providerPatterns } = options;

    // If we detected the pattern from the website, prioritize it heavily
    if (detectedPattern && PATTERN_MAP[detectedPattern]) {
        addPattern(PATTERN_MAP[detectedPattern], 50);
    }

    // Add provider-preferred patterns with a boost
    if (providerPatterns) {
        for (const pid of providerPatterns) {
            if (PATTERN_MAP[pid]) {
                addPattern(PATTERN_MAP[pid], 20);
            }
        }
    }

    // Add all remaining patterns
    for (const template of ALL_PATTERNS) {
        addPattern(template);
    }

    // Sort by weight descending
    results.sort((a, b) => b.weight - a.weight);

    return results;
}

module.exports = { generatePatterns, ALL_PATTERNS };
