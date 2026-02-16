import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

export async function POST(request) {
    const apiKey = request.headers.get('x-api-key');
    const validApiKey = apiKey && apiKey === process.env.API_KEY;
    if (!validApiKey) {
        const session = await getServerSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { domain } = await request.json();
        if (!domain) {
            return NextResponse.json({ error: 'domain is required.' }, { status: 400 });
        }

        const { searchDomain } = require('@/lib/domainSearch');
        const result = await searchDomain(domain);
        return NextResponse.json(result);

    } catch (err) {
        console.error('Domain search error:', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
