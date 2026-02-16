import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

export async function GET(request) {
    const apiKey = request.headers.get('x-api-key');
    const validApiKey = apiKey && apiKey === process.env.API_KEY;
    if (!validApiKey) {
        const session = await getServerSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const { getHistory } = require('@/lib/history');
    const data = getHistory(page, limit);
    return NextResponse.json(data);
}

export async function DELETE(request) {
    const apiKey = request.headers.get('x-api-key');
    const validApiKey = apiKey && apiKey === process.env.API_KEY;
    if (!validApiKey) {
        const session = await getServerSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clearHistory } = require('@/lib/history');
    clearHistory();
    return NextResponse.json({ success: true });
}
