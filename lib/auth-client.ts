import { AuthenticationDetails, CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js';

// Cognito User Pool configuration (client-side)
const poolData = {
    UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
    ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
};

const userPool = new CognitoUserPool(poolData);

export interface AuthTokens {
    idToken: string;
    accessToken: string;
    refreshToken: string;
}

export interface NewPasswordChallenge {
    challengeName: 'NEW_PASSWORD_REQUIRED';
    cognitoUser: CognitoUser;
    userAttributes: any;
}

export type AuthResult = AuthTokens | NewPasswordChallenge;

/**
 * Authenticate user with Cognito (client-side only)
 */
export function authenticateUser(
    username: string,
    password: string
): Promise<AuthResult> {
    return new Promise((resolve, reject) => {
        const authenticationDetails = new AuthenticationDetails({
            Username: username,
            Password: password,
        });

        const cognitoUser = new CognitoUser({
            Username: username,
            Pool: userPool,
        });

        cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: (result) => {
                const idToken = result.getIdToken().getJwtToken();
                const accessToken = result.getAccessToken().getJwtToken();
                const refreshToken = result.getRefreshToken().getToken();

                resolve({
                    idToken,
                    accessToken,
                    refreshToken,
                });
            },
            onFailure: (err) => {
                reject(err);
            },
            newPasswordRequired: (userAttributes, requiredAttributes) => {
                // Return challenge info so the UI can handle password change
                resolve({
                    challengeName: 'NEW_PASSWORD_REQUIRED',
                    cognitoUser,
                    userAttributes,
                });
            },
        });
    });
}

/**
 * Complete new password challenge
 */
export function completeNewPassword(
    cognitoUser: CognitoUser,
    newPassword: string,
    userAttributes: any
): Promise<AuthTokens> {
    return new Promise((resolve, reject) => {
        // Remove attributes that shouldn't be updated
        delete userAttributes.email_verified;
        delete userAttributes.phone_number_verified;

        cognitoUser.completeNewPasswordChallenge(newPassword, userAttributes, {
            onSuccess: (result) => {
                const idToken = result.getIdToken().getJwtToken();
                const accessToken = result.getAccessToken().getJwtToken();
                const refreshToken = result.getRefreshToken().getToken();

                resolve({
                    idToken,
                    accessToken,
                    refreshToken,
                });
            },
            onFailure: (err) => {
                reject(err);
            },
        });
    });
}

