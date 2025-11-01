import { getCurrentUser } from './auth-server';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './prisma';

/**
 * Get or create session based on Cognito username
 * Each Cognito user always gets the same session (and their media)
 */
export async function getOrCreateSession(): Promise<string> {
    // Get Cognito user info (middleware guarantees this exists)
    const user = await getCurrentUser();
    
    if (!user?.username) {
        throw new Error('Not authenticated');
    }
    
    // Find or create session by Cognito username
    const session = await prisma.session.upsert({
        where: { cognitoUsername: user.username },
        update: { lastSeen: new Date() },
        create: { 
            id: uuidv4(),
            cognitoUsername: user.username 
        },
    });
    
    return session.id;
}

/**
 * Get session ID (returns null if not authenticated)
 */
export async function getSessionId(): Promise<string | null> {
    try {
        return await getOrCreateSession();
    } catch {
        return null;
    }
}
