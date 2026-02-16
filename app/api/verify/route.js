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
        const { email, emails } = await request.json();

        if (emails && Array.isArray(emails)) {
            const { batchVerify } = require('@/lib/emailVerifier');
            const results = await batchVerify(emails.slice(0, 100));
            return NextResponse.json({ mode: 'batch', results });
        }

        if (!email) {
            return NextResponse.json({ error: 'email is required.' }, { status: 400 });
        }

        const { verifyEmail } = require('@/lib/emailVerifier');
        const result = await verifyEmail(email);
        return NextResponse.json({ mode: 'single', ...result });

    } catch (err) {
        console.error('Verify error:', err);
        return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
    }
}
