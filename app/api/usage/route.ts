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
        const calculateStats = async (assets: typeof allAssets, startDate: Date) => {
            const imagen4Count = assets.filter(a => a.provider === 'google-imagen4').length;
            const nanoBananaCount = assets.filter(a => a.provider === 'gemini-nano-banana').length;
            const qwenCount = assets.filter(a => a.provider === 'qwen-image-edit-plus').length;
            const seedEdit3Count = assets.filter(a => a.provider === 'seededit-3.0').length;
            const seedream4Count = assets.filter(a => a.provider === 'seedream-4').length;
            const novaCanvasCount = assets.filter(a => a.provider === 'aws-nova-canvas').length;
            const veo31Count = assets.filter(a => a.provider === 'google-veo-3.1').length;

            // Count mask generations from actions table
            const maskGenerationCount = await prisma.action.count({
                where: {
                    userId: sessionId,
                    action: 'mask_generated',
                    createdAt: { gte: startDate }
                }
            });

            const imagen4Cost = calculateCost('google-imagen4', imagen4Count);
            const nanoBananaCost = calculateCost('gemini-nano-banana', nanoBananaCount);
            const qwenCost = calculateCost('qwen-image-edit-plus', qwenCount);
            const seedEdit3Cost = calculateCost('seededit-3.0', seedEdit3Count);
            const seedream4Cost = calculateCost('seedream-4', seedream4Count);
            const novaCanvasCost = calculateCost('aws-nova-canvas', novaCanvasCount);
            const veo31Cost = calculateCost('google-veo-3.1', veo31Count);
            const maskCost = maskGenerationCount * 0.0014; // Grounded SAM cost

            return {
                imagen4: imagen4Count,
                nanoBanana: nanoBananaCount,
                qwenImageEditPlus: qwenCount,
                seedEdit3: seedEdit3Count,
                seedream4: seedream4Count,
                novaCanvas: novaCanvasCount,
                veo31: veo31Count,
                maskGenerations: maskGenerationCount,
                total: imagen4Count + nanoBananaCount + qwenCount + seedEdit3Count + seedream4Count + novaCanvasCount + veo31Count + maskGenerationCount,
                cost: imagen4Cost + nanoBananaCost + qwenCost + seedEdit3Cost + seedream4Cost + novaCanvasCost + veo31Cost + maskCost,
            };
        };

        // Calculate stats for each time period
        const today = await calculateStats(
            allAssets.filter(a => a.createdAt >= todayStart),
            todayStart
        );

        const thisWeek = await calculateStats(
            allAssets.filter(a => a.createdAt >= weekStart),
            weekStart
        );

        const thisMonth = await calculateStats(
            allAssets.filter(a => a.createdAt >= monthStart),
            monthStart
        );

        const allTime = await calculateStats(allAssets, new Date(0)); // All time starts from epoch

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

