import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

export async function middleware(request) {
    const { pathname } = request.nextUrl;

    // Protect dashboard route
    if (pathname.startsWith('/dashboard')) {
        const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
        if (!token) {
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    // Protect API (except auth endpoints)
    if (pathname.startsWith('/api/find-email')) {
        const apiKey = request.headers.get('x-api-key');
        if (apiKey && apiKey === process.env.API_KEY) {
            return NextResponse.next();
        }
        // Otherwise let the route handler check session
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*', '/api/find-email/:path*'],
};
