/**
 * Search History — JSON file-based persistent storage.
 */
const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(process.cwd(), 'data', 'history.json');
const MAX_ENTRIES = 1000;

function ensureDataDir() {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function readHistory() {
    ensureDataDir();
    try {
        if (!fs.existsSync(HISTORY_FILE)) return [];
        const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

function writeHistory(entries) {
    ensureDataDir();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2));
}

/**
 * Add a search result to history.
 */
function addToHistory(entry) {
    const history = readHistory();
    history.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        firstName: entry.firstName,
        lastName: entry.lastName,
        domainOrCompany: entry.domainOrCompany,
        domain: entry.domain,
        bestEmail: entry.bestEmail,
        confidence: entry.confidence,
        score: entry.score,
        provider: entry.provider,
        totalResults: entry.totalResults,
        isCatchAll: entry.isCatchAll,
        duration: entry.duration,
    });

    // Trim to max
    if (history.length > MAX_ENTRIES) {
        history.length = MAX_ENTRIES;
    }

    writeHistory(history);
}

/**
 * Get search history with optional pagination.
 */
function getHistory(page = 1, limit = 50) {
    const history = readHistory();
    const start = (page - 1) * limit;
    return {
        entries: history.slice(start, start + limit),
        total: history.length,
        page,
        totalPages: Math.ceil(history.length / limit),
    };
}

/**
 * Clear all history.
 */
function clearHistory() {
    writeHistory([]);
}

module.exports = { addToHistory, getHistory, clearHistory };
