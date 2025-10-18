import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const sessionId = await getOrCreateSession();
        const { id } = await params;

        // Verify the image belongs to this session
        const asset = await prisma.mediaAsset.findFirst({
            where: {
                id,
                owner: sessionId,
            },
        });

        if (!asset) {
            return NextResponse.json({ error: 'Image not found' }, { status: 404 });
        }

        // Parse metadata to get original image ID if it exists
        let originalImageId = null;
        if (asset.metadata) {
            try {
                const metadata = JSON.parse(asset.metadata);
                originalImageId = metadata.originalImageId || null;
            } catch (e) {
                console.error('Error parsing metadata:', e);
            }
        }

        return NextResponse.json({
            success: true,
            asset: {
                ...asset,
                originalImageId,
            },
        });
    } catch (error) {
        console.error('Error fetching image:', error);
        return NextResponse.json(
            { error: 'Failed to fetch image' },
            { status: 500 }
        );
    }
}

