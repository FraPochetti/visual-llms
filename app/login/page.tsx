'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authenticateUser, completeNewPassword } from '@/lib/auth-client';
import type { CognitoUser } from 'amazon-cognito-identity-js';

function LoginPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
    const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);
    const [userAttributes, setUserAttributes] = useState<any>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // Authenticate with Cognito
            const result = await authenticateUser(username, password);

            // Check if password change is required
            if ('challengeName' in result && result.challengeName === 'NEW_PASSWORD_REQUIRED') {
                setCognitoUser(result.cognitoUser);
                setUserAttributes(result.userAttributes);
                setPasswordChangeRequired(true);
                setIsLoading(false);
                return;
            }

            // Send tokens to server to set httpOnly cookies
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result),
            });

            if (!response.ok) {
                throw new Error('Failed to set authentication cookies');
            }

            // Redirect to the page they were trying to access, or home
            const redirect = searchParams.get('redirect') || '/';
            router.push(redirect);
            router.refresh();
        } catch (err: any) {
            console.error('Login error:', err);
            
            // Handle specific error messages
            if (err.code === 'NotAuthorizedException') {
                setError('Incorrect username or password');
            } else if (err.code === 'UserNotFoundException') {
                setError('User does not exist');
            } else {
                setError(err.message || 'Login failed. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        // Validate password strength
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        if (!cognitoUser || !userAttributes) {
            setError('Session expired. Please try logging in again.');
            setPasswordChangeRequired(false);
            return;
        }

        setIsLoading(true);

        try {
            // Complete the password change challenge
            const tokens = await completeNewPassword(cognitoUser, newPassword, userAttributes);

            // Send tokens to server to set httpOnly cookies
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tokens),
            });

            if (!response.ok) {
                throw new Error('Failed to set authentication cookies');
            }

            // Redirect to home
            const redirect = searchParams.get('redirect') || '/';
            router.push(redirect);
            router.refresh();
        } catch (err: any) {
            console.error('Password change error:', err);
            setError(err.message || 'Failed to change password. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <div className="max-w-md w-full mx-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
                    {/* Logo/Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Visual Neurons
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            {passwordChangeRequired ? 'Change Your Password' : 'Prompt. Picture. Video.'}
                        </p>
                    </div>

                    {passwordChangeRequired ? (
                        /* Password Change Form */
                        <form onSubmit={handlePasswordChange} className="space-y-6">
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-4 py-3 rounded-lg text-sm">
                                Please set a new password for your account.
                            </div>

                            <div>
                                <label
                                    htmlFor="newPassword"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                                >
                                    New Password
                                </label>
                                <input
                                    id="newPassword"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white transition"
                                    placeholder="Enter new password"
                                    required
                                    autoFocus
                                    disabled={isLoading}
                                    minLength={8}
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Must be at least 8 characters long
                                </p>
                            </div>

                            <div>
                                <label
                                    htmlFor="confirmPassword"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                                >
                                    Confirm Password
                                </label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white transition"
                                    placeholder="Confirm new password"
                                    required
                                    disabled={isLoading}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !newPassword || !confirmPassword}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                        Changing Password...
                                    </>
                                ) : (
                                    'Change Password'
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setPasswordChangeRequired(false);
                                    setCognitoUser(null);
                                    setUserAttributes(null);
                                    setNewPassword('');
                                    setConfirmPassword('');
                                    setError('');
                                }}
                                className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                                disabled={isLoading}
                            >
                                ← Back to Login
                            </button>
                        </form>
                    ) : (
                        /* Login Form */
                        <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label
                                htmlFor="username"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                            >
                                Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white transition"
                                placeholder="Enter your username"
                                required
                                autoFocus
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                            >
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-700 dark:text-white transition"
                                placeholder="Enter your password"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !username || !password}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>
                    )}

                    {/* Footer */}
                    <div className="mt-6 text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Secured with AWS Cognito
                        </p>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        No account creation available. Contact admin for access.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                <div className="text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
        }>
            <LoginPageContent />
        </Suspense>
    );
}

