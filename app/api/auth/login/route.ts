import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookies } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
    try {
        const tokens = await request.json();
        
        // Validate tokens exist
        if (!tokens.idToken || !tokens.accessToken || !tokens.refreshToken) {
            return NextResponse.json(
                { error: 'Invalid tokens' },
                { status: 400 }
            );
        }
        
        // Set httpOnly cookies
        await setAuthCookies(tokens);
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Login API error:', error);
        return NextResponse.json(
            { error: 'Failed to set authentication cookies' },
            { status: 500 }
        );
    }
}

