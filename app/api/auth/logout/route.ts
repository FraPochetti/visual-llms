import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth-server';

export async function POST() {
    try {
        await clearAuthCookies();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logout API error:', error);
        return NextResponse.json(
            { error: 'Failed to clear authentication cookies' },
            { status: 500 }
        );
    }
}

