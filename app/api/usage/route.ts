import { NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { calculateCost } from '@/lib/pricing';

export async function GET() {
    try {
        const sessionId = await getOrCreateSession();

        // Calculate time period boundaries
        const now = new Date();

        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        weekStart.setHours(0, 0, 0, 0);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Query all media assets for this session (excluding user uploads)
        const allAssets = await prisma.mediaAsset.findMany({
            where: {
                owner: sessionId,
                provider: {
                    not: 'local-fs' // Exclude user uploads
                }
            },
            select: {
                provider: true,
                createdAt: true,
            }
        });

        // Helper to count and calculate cost
        const calculateStats = (assets: typeof allAssets) => {
            const imagen4Count = assets.filter(a => a.provider === 'google-imagen4').length;
            const nanoBananaCount = assets.filter(a => a.provider === 'gemini-nano-banana').length;
            const veo31Count = assets.filter(a => a.provider === 'google-veo-3.1').length;

            const imagen4Cost = calculateCost('google-imagen4', imagen4Count);
            const nanoBananaCost = calculateCost('gemini-nano-banana', nanoBananaCount);
            const veo31Cost = calculateCost('google-veo-3.1', veo31Count);

            return {
                imagen4: imagen4Count,
                nanoBanana: nanoBananaCount,
                veo31: veo31Count,
                total: imagen4Count + nanoBananaCount + veo31Count,
                cost: imagen4Cost + nanoBananaCost + veo31Cost,
            };
        };

        // Calculate stats for each time period
        const today = calculateStats(
            allAssets.filter(a => a.createdAt >= todayStart)
        );

        const thisWeek = calculateStats(
            allAssets.filter(a => a.createdAt >= weekStart)
        );

        const thisMonth = calculateStats(
            allAssets.filter(a => a.createdAt >= monthStart)
        );

        const allTime = calculateStats(allAssets);

        return NextResponse.json({
            success: true,
            stats: {
                today,
                thisWeek,
                thisMonth,
                allTime,
            }
        });
    } catch (error) {
        console.error('Error fetching usage stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch usage stats' },
            { status: 500 }
        );
    }
}

