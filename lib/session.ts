import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './prisma';

const SESSION_COOKIE_NAME = 'vn_session';

export async function getOrCreateSession(): Promise<string> {
    const cookieStore = await cookies();
    let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionId) {
        // Create new session
        sessionId = uuidv4();

        // Store in database
        await prisma.session.create({
            data: {
                id: sessionId,
            },
        });

        // Set cookie
        cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 365, // 1 year
            path: '/',
        });
    } else {
        // Update last seen
        await prisma.session.upsert({
            where: { id: sessionId },
            update: { lastSeen: new Date() },
            create: { id: sessionId },
        });
    }

    return sessionId;
}

export async function getSessionId(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}

