import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const sessionId = await getOrCreateSession();

        const assets = await prisma.mediaAsset.findMany({
            where: {
                owner: sessionId,
                saved: true, // Only show explicitly saved images
            },
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                actions: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 1,
                },
            },
        });

        return NextResponse.json({
            success: true,
            assets,
        });
    } catch (error) {
        console.error('Error fetching gallery:', error);
        return NextResponse.json(
            { error: 'Failed to fetch gallery' },
            { status: 500 }
        );
    }
}

