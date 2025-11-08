import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'vn_auth_token';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow access to login page, webhooks, and auth endpoints
    if (pathname === '/login' || 
        pathname.startsWith('/_next') || 
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/webhooks')) {
        return NextResponse.next();
    }

    // Check for authentication token
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

    // If no token, redirect to login
    if (!token) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Token exists, allow access
    // Note: Full JWT verification happens in server components/API routes
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, icon.png (favicon files)
         * - public files (images, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|icon.png|faviconTab.png|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$).*)',
    ],
};

