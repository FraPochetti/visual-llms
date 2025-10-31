import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const AUTH_COOKIE_NAME = 'vn_auth_token';
const REFRESH_COOKIE_NAME = 'vn_refresh_token';

export interface AuthTokens {
    idToken: string;
    accessToken: string;
    refreshToken: string;
}

/**
 * Set authentication cookies (server-side)
 */
export async function setAuthCookies(tokens: AuthTokens) {
    const cookieStore = await cookies();
    
    // Set ID token (used for authentication)
    cookieStore.set(AUTH_COOKIE_NAME, tokens.idToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60, // 1 hour (matches token expiry)
        path: '/',
    });

    // Set refresh token (for token renewal)
    cookieStore.set(REFRESH_COOKIE_NAME, tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
    });
}

/**
 * Clear authentication cookies (server-side)
 */
export async function clearAuthCookies() {
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
    cookieStore.delete(REFRESH_COOKIE_NAME);
}

/**
 * Get authentication token from cookies (server-side)
 */
export async function getAuthToken(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get(AUTH_COOKIE_NAME)?.value || null;
}

/**
 * Verify JWT token from Cognito (server-side)
 */
export async function verifyToken(token: string): Promise<boolean> {
    try {
        const region = process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1';
        const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
        
        // Cognito's public keys URL
        const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
        
        // Get the JWKS endpoint
        const jwksUrl = `${issuer}/.well-known/jwks.json`;
        
        // Fetch JWKS
        const jwksResponse = await fetch(jwksUrl);
        const jwks = await jwksResponse.json();
        
        // Get the kid from token header
        const tokenParts = token.split('.');
        const header = JSON.parse(Buffer.from(tokenParts[0], 'base64').toString());
        const kid = header.kid;
        
        // Find the matching key
        const key = jwks.keys.find((k: any) => k.kid === kid);
        if (!key) {
            return false;
        }
        
        // Convert JWK to crypto key format for jose
        const cryptoKey = await crypto.subtle.importKey(
            'jwk',
            key,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['verify']
        );
        
        // Verify the token
        const { payload } = await jwtVerify(
            token,
            cryptoKey,
            {
                issuer,
                audience: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
            }
        );
        
        // Check expiration
        if (payload.exp && payload.exp < Date.now() / 1000) {
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Token verification failed:', error);
        return false;
    }
}

/**
 * Check if user is authenticated (server-side)
 */
export async function isAuthenticated(): Promise<boolean> {
    const token = await getAuthToken();
    if (!token) {
        return false;
    }
    
    return await verifyToken(token);
}

/**
 * Get current user info from token (server-side)
 */
export async function getCurrentUser(): Promise<any | null> {
    const token = await getAuthToken();
    if (!token) {
        return null;
    }
    
    try {
        // Decode token (without verification, just to get claims)
        const tokenParts = token.split('.');
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        
        return {
            username: payload['cognito:username'] || payload.sub,
            email: payload.email,
            sub: payload.sub,
        };
    } catch (error) {
        return null;
    }
}

