import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

export async function POST(request) {
    // Auth check: session OR API key
    const apiKey = request.headers.get('x-api-key');
    const validApiKey = apiKey && apiKey === process.env.API_KEY;

    if (!validApiKey) {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        const body = await request.json();
        const { firstName, lastName, domainOrCompany, bulk, csv } = body;

        // Bulk mode: process CSV
        if (bulk || csv) {
            const { parseCSV, processBulk } = require('@/lib/csvProcessor');
            const rows = typeof csv === 'string' ? parseCSV(csv) : csv;

            if (!rows || rows.length === 0) {
                return NextResponse.json({ error: 'No valid rows found.' }, { status: 400 });
            }

            if (rows.length > 500) {
                return NextResponse.json({ error: 'Max 500 rows per batch.' }, { status: 400 });
            }

            const results = await processBulk(rows, 10);
            return NextResponse.json({
                mode: 'bulk',
                total: rows.length,
                results,
            });
        }

        // Single mode
        if (!firstName || !lastName || !domainOrCompany) {
            return NextResponse.json({ error: 'firstName, lastName, and domainOrCompany are required.' }, { status: 400 });
        }

        const { findEmail } = require('@/lib/emailFinder');
        const result = await findEmail({ firstName, lastName, domainOrCompany });

        // Save to history
        try {
            const { addToHistory } = require('@/lib/history');
            const best = result.results[0];
            addToHistory({
                firstName, lastName, domainOrCompany,
                domain: result.meta?.domain,
                bestEmail: best?.email || null,
                confidence: best?.confidence || null,
                score: best?.score || 0,
                provider: result.meta?.provider,
                totalResults: result.results.length,
                isCatchAll: result.meta?.isCatchAll,
                duration: result.meta?.duration,
            });
        } catch { }

        return NextResponse.json({
            mode: 'single',
            ...result,
        });

    } catch (err) {
        console.error('API error:', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
