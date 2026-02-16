/**
 * CSV Processor — Bulk email finding with concurrency control.
 */
const { findEmail } = require('./emailFinder');

/**
 * Process an array of lookup requests concurrently.
 *
 * @param {Array<{firstName: string, lastName: string, domainOrCompany: string}>} rows
 * @param {number} concurrency — max parallel lookups
 * @param {Function} onProgress — callback(completed, total, result)
 * @returns {Promise<Array>}
 */
async function processBulk(rows, concurrency = 10, onProgress = null) {
    const results = new Array(rows.length);
    let completed = 0;
    let running = 0;
    let index = 0;

    return new Promise((resolve) => {
        function startNext() {
            while (running < concurrency && index < rows.length) {
                const i = index++;
                running++;

                const row = rows[i];
                findEmail({
                    firstName: row.firstName || '',
                    lastName: row.lastName || '',
                    domainOrCompany: row.domainOrCompany || row.domain || row.company || '',
                })
                    .then((result) => {
                        // Pick the best result
                        const best = result.results[0];
                        results[i] = {
                            ...row,
                            email: best?.email || '',
                            confidence: best?.confidence || 'none',
                            score: best?.score || 0,
                            method: best?.method || '',
                            allResults: result.results.slice(0, 5),
                            meta: result.meta,
                        };
                    })
                    .catch((err) => {
                        results[i] = {
                            ...row,
                            email: '',
                            confidence: 'error',
                            score: 0,
                            method: 'error',
                            error: err.message,
                        };
                    })
                    .finally(() => {
                        completed++;
                        running--;
                        if (onProgress) onProgress(completed, rows.length, results[i]);
                        if (completed === rows.length) {
                            resolve(results);
                        } else {
                            startNext();
                        }
                    });
            }
        }
        startNext();
    });
}

/**
 * Parse CSV text into rows. Auto-detect delimiter and headers.
 */
function parseCSV(text) {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];

    // Detect delimiter
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

    // Parse header
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

    // Map common header names
    const headerMap = {};
    for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        if (['first_name', 'firstname', 'first name', 'first', 'name'].includes(h)) headerMap.firstName = i;
        else if (['last_name', 'lastname', 'last name', 'last', 'surname'].includes(h)) headerMap.lastName = i;
        else if (['domain', 'company_domain', 'email_domain', 'website'].includes(h)) headerMap.domainOrCompany = i;
        else if (['company', 'company_name', 'organization', 'org'].includes(h)) {
            if (headerMap.domainOrCompany === undefined) headerMap.domainOrCompany = i;
        }
    }

    // If no headers detected, assume first_name, last_name, domain
    if (headerMap.firstName === undefined) headerMap.firstName = 0;
    if (headerMap.lastName === undefined) headerMap.lastName = 1;
    if (headerMap.domainOrCompany === undefined) headerMap.domainOrCompany = 2;

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map(c => c.trim().replace(/['"]/g, ''));
        rows.push({
            firstName: cols[headerMap.firstName] || '',
            lastName: cols[headerMap.lastName] || '',
            domainOrCompany: cols[headerMap.domainOrCompany] || '',
        });
    }

    return rows;
}

module.exports = { processBulk, parseCSV };
