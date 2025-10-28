'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCost } from '@/lib/pricing';

type PeriodStats = {
    imagen4: number;
    nanoBanana: number;
    veo31: number;
    total: number;
    cost: number;
};

type UsageStats = {
    today: PeriodStats;
    thisWeek: PeriodStats;
    thisMonth: PeriodStats;
    allTime: PeriodStats;
};

export default function UsagePage() {
    const [stats, setStats] = useState<UsageStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/usage');
            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Error fetching usage stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({
        title,
        period
    }: {
        title: string;
        period: PeriodStats | undefined;
    }) => (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {title}
            </h3>
            {period ? (
                <>
                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                                <Link href="https://replicate.com/google/imagen-4-ultra" target="_blank" className="underline hover:text-blue-600">
                                    Imagen 4
                                </Link>:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {period.imagen4} {period.imagen4 === 1 ? 'image' : 'images'}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                                <Link href="https://replicate.com/google/nano-banana" target="_blank" className="underline hover:text-blue-600">
                                    Nano Banana
                                </Link>:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {period.nanoBanana} {period.nanoBanana === 1 ? 'op' : 'ops'}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                                <Link href="https://replicate.com/google/veo-3.1" target="_blank" className="underline hover:text-blue-600">
                                    Veo 3.1
                                </Link>:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {period.veo31} {period.veo31 === 1 ? 'video' : 'videos'}
                            </span>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Total Operations:
                            </span>
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                                {period.total}
                            </span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Estimated Cost:
                            </span>
                            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {formatCost(period.cost)}
                            </span>
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-gray-500 dark:text-gray-400">No data</div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Usage & Costs
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Track your API usage and estimated costs
                        </p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <Link
                            href="/"
                            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
                        >
                            Chat
                        </Link>
                        <Link
                            href="/gallery"
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            Gallery
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-gray-500 dark:text-gray-400">Loading stats...</div>
                    </div>
                ) : (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <StatCard title="Today" period={stats?.today} />
                            <StatCard title="This Week" period={stats?.thisWeek} />
                            <StatCard title="This Month" period={stats?.thisMonth} />
                            <StatCard title="All Time" period={stats?.allTime} />
                        </div>

                        {/* Pricing Info */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                                💡 Pricing Information
                            </h3>
                            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                <p>
                                    <strong>
                                        <Link href="https://replicate.com/google/imagen-4-ultra" target="_blank" className="underline hover:text-blue-600">
                                            Imagen 4 Ultra
                                        </Link>:
                                    </strong> $0.06 per image (highest quality)
                                </p>
                                <p>
                                    <strong>
                                        <Link href="https://replicate.com/google/nano-banana" target="_blank" className="underline hover:text-blue-600">
                                            Nano Banana
                                        </Link>:
                                    </strong> ≈$0.039 per 1024×1024 image
                                </p>
                                <p>
                                    <strong>
                                        <Link href="https://replicate.com/google/veo-3.1" target="_blank" className="underline hover:text-blue-600">
                                            Veo 3.1
                                        </Link>:
                                    </strong> $3.20 per 8-second video ($0.40/second, includes native audio)
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                                    Costs are estimates based on Replicate pricing. Actual costs may vary based on runtime, hardware, resolution, and batch mode.
                                    See <a href="https://replicate.com/pricing" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">Replicate pricing</a> for details.
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}

